<template>
  <div class="w-full h-full flex flex-col gap-2 p-2">
    <div class="flex flex-row items-center w-full gap-2 pr-10">
      <span class="flex-auto" />
      <Checkbox v-model="autoProcess" class="self-center" binary />
      <label class="self-center">自动处理</label>
      <Button icon="pi pi-table" label="提取表格" severity="secondary" raised @click="onExtractTable"
        :disabled="!canExtract"></Button>
      <Button icon="pi pi-table" label="复制表格" raised @click="onCopyTable" :disabled="!canCopy"></Button>
    </div>
    <div ref="extractedTable" class="w-full p-2 items-center justify-center flex-col">
    </div>
    <Toast position="top-center" />
  </div>
</template>


<script setup lang="ts">


const props = defineProps<{
  image: string
}>()

const toast = useToast()

const extractedTable = useTemplateRef('extractedTable')
const canExtract = ref<boolean>(props.image.length > 0)
const canCopy = ref<boolean>(false)
const autoProcess = ref<boolean>(false)

watch(props, (newProps) => {
  if (extractedTable.value) {
    canCopy.value = (extractedTable.value.innerHTML.length || 0) > 0
    canExtract.value = newProps.image.length > 0
    if (canExtract.value && autoProcess.value) {
      onExtractTable()
    }
  }
})


function cssToString(css: CSSStyleDeclaration) {
  const keptStyles = ['background-color', 'color', 'width']
  const styles: string[] = []
  for (const style of keptStyles) {
    const value = css.getPropertyValue(style)
    if (value) {
      styles.push(`${style}: ${value}`)
    }
  }
  return styles.join('; ')
}


function addComputedStyle(node: HTMLElement) {
  const computedStyle = window.getComputedStyle(node)
  const cloned = node.cloneNode(false) as HTMLElement
  cloned.style.cssText = cssToString(computedStyle)
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const textNode = document.createTextNode((child as Text).textContent || '')
      cloned.appendChild(textNode)
    } else {
      cloned.appendChild(addComputedStyle(child as HTMLElement))
    }
  }
  return cloned
}

async function onCopyTable() {

  if (!extractedTable.value) return

  const clipboard = navigator.clipboard

  if (!clipboard) {
    console.error('Clipboard API not available')
    return
  }

  const table = addComputedStyle(extractedTable.value)


  const html = table.innerHTML.replaceAll(/<br\/?>/g, '\n')
  await clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([html], { type: 'text/plain' })
    })
  ])

  toast.add({
    severity: 'success',
    summary: '表格已复制到剪贴板',
    life: 3000
  })

}

function updateTable(html: string) {
  if (extractedTable.value) {
    extractedTable.value.innerHTML = html
  }
}

async function onExtractTable() {
  if (!props.image) {
    return
  }
  canExtract.value = false
  updateTable('正在提取表格...')
  try {

    const resp = await $fetch<ReadableStream>('/api/extract', {
      method: 'POST',
      body: props.image,
      responseType: 'stream'
    })

    const reader = resp.getReader();

    const decoder = new TextDecoder('utf-8')
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      result += decoder.decode(value)
      //emit('extracted', { body: removeQuote(result), extracted: false })
      updateTable(removeQuote(result))
    }
    canCopy.value = (extractedTable.value?.innerHTML.length || 0) > 0

    if (canCopy.value && autoProcess.value) {
      await onCopyTable()
    }
  } catch (e) {
    console.error(e)
  }
}

function removeQuote(str: string) {
  let startPos = str.indexOf('```')
  if (startPos === -1) {
    return str
  }
  const brPos = str.indexOf('\n', startPos)
  if (brPos === -1) {
    startPos += 3
  } else {
    startPos = brPos + 1
  }
  const endPos = str.indexOf('```', startPos)
  if (endPos === -1) {
    return str.substring(startPos)
  }
  return str.substring(startPos, endPos)
}

</script>