import { randomUUID } from 'node:crypto'

function buildLlmRequest(image: string, llm: any): any {
  return {
    model: llm.model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: image,
            },
          },
          {
            type: "text",
            text:
              `Please analyze these image and extract any tables as HTML tables. Handle line wraps in cells carefully, using '<br/>' when needed.
the <table> tag should have the class 'easy-table', no other classes or attributes should be added to the table. 
`,
          },
        ],
      }
    ],
    stream: true,
    stream_options: { include_usage: true }
  }
}

function concatArrayBuffers(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const totalLength = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function parseLlmChunk(chunk: Uint8Array, logPrefix: string): string {
  if (!chunk || chunk.length === 0) {
    return '';
  }
  const line = new TextDecoder().decode(chunk).trim();
  if (!line) {
    return '';
  }
  if (line.startsWith('data:')) {
    try {
      const chunk = JSON.parse(line.slice(5));
      const part = chunk.choices[0]?.delta?.content as string || ''
      if (chunk.usage?.prompt_tokens) {
        console.info(logPrefix, 'LLM usage:', JSON.stringify(chunk.usage))
      }
      return part;
    } catch (e) {
      console.error(logPrefix, 'Failed to parse LLM response', e, 'line:', line)
    }
  }
  return '';
}

function llmStream(logPrefix: string) {


  let buffer = new Uint8Array()

  return new TransformStream<Uint8Array, string>({

    start() {
    },

    transform(chunk: Uint8Array, controller: TransformStreamDefaultController<string>) {
      let index;
      let rest = chunk;
      while ((index = rest.indexOf(0x0a)) !== -1) {
        const content = parseLlmChunk(concatArrayBuffers([buffer, rest.slice(0, index + 1)]), logPrefix);
        if (content) {
          controller.enqueue(content);
        }
        rest = rest.slice(index + 1);
        buffer = new Uint8Array();
      }

      if (rest.length > 0) {
        buffer = concatArrayBuffers([buffer, rest]);
      }
    },

    flush(controller: TransformStreamDefaultController<string>) {
      if (buffer.length > 0) {
        controller.enqueue(parseLlmChunk(buffer, logPrefix));
      }
    }
  });
}

function makeUUID() {
  return randomUUID()
}

export default defineEventHandler(async (event) => {

  const userIp = getRequestIP(event, { xForwardedFor: true })
  const reqId = getRequestHeader(event, 'x-request-id') || makeUUID()

  const logPrefix = `[${reqId} ${userIp}]`

  console.info(logPrefix, 'extract start')

  const image = await readRawBody(event)
  if (!image) {
    console.error(logPrefix, 'No image found in request')
    return new Response('No image found in request', { status: 400 })
  }

  const { llm } = useRuntimeConfig()

  const req = buildLlmRequest(image, llm)
  const url = `${llm.baseURL}/chat/completions`

  console.info(logPrefix, 'Sending request to ', url, 'with image', image.length, 'bytes')

  const resp = await fetch(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llm.apiKey}`,
        'x-portkey-provider': llm.provider,
      },
      body: JSON.stringify(req),
    });

  if (resp.status !== 200) {
    const body = await resp.text()
    console.error(logPrefix, 'Failed to send request to LLM', body)
    return new Response('Failed to send request to LLM \n' + body, { status: 500 })
  }
  if (!resp.body) {
    console.error(logPrefix, 'No response body from LLM')
    return new Response('No response body from LLM', { status: 500 })
  }

  const stream = resp.body.pipeThrough(llmStream(logPrefix))

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/html',
      'transfer-encoding': 'chunked',
    },
  })
})