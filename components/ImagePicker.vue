<template>
  <div class="w-full h-full flex flex-col gap-2 ">
    <div class="w-full flex flex-row gap-2 items-center justify-center">
      <FileUpload class=" self-center" mode="basic" accept="image/*" @select="onSelectFile" chooseLabel="选择文件"
        chooseIcon="pi pi-folder-open" :chooseButtonProps="{ severity: 'secondary', raised: true }">
      </FileUpload>
    </div>
    <div
      class="flex-auto flex flex-col items-center justify-center border-1 border-dashed border-gray-300 rounded-lg overflow-auto"
      @paste="onPasteImage">
      <div v-if="!imageBody">亦可在此按下Ctrl+V来粘贴图片</div>
      <img v-else :src="imageBody" class="max-w-full max-h-full" />
    </div>

  </div>
</template>

<script setup lang="ts">
import type { FileUploadSelectEvent } from 'primevue';


const imageBody = ref<string>('')

const emit = defineEmits<{
  imageChanged: [string]
}>()


/**
 * Handle the file selection event
 * read the file and set the imageBody 
 */
async function onSelectFile(event: FileUploadSelectEvent) {
  const file = event.files[0]
  const reader = new FileReader()
  reader.onload = (e) => {
    imageBody.value = e.target?.result as string
    emit('imageChanged', imageBody.value)
  }
  reader.readAsDataURL(await compressImage(file))
}


/**
 * Handle the paste event
 * read the file and set the imageBody 
 */

async function onPasteImage(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.indexOf('image') === -1) continue
    const blob = item.getAsFile()
    if (!blob) continue
    const reader = new FileReader()
    reader.onload = (e) => {
      imageBody.value = e.target?.result as string
      emit('imageChanged', imageBody.value)
    }
    reader.readAsDataURL(await compressImage(blob))
    break
  }
}

async function compressImage(imageData: Blob): Promise<Blob> {

  const img = await createImageBitmap(imageData)

  const maxWidth = 1536
  const maxHeight = 1536
  const ratio = Math.min(maxWidth / img.width, maxHeight / img.height)
  if (ratio >= 1) {
    return imageData
  }

  const canvas = new OffscreenCanvas(Math.round(img.width * ratio), Math.round(img.height * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return imageData
  }
  ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
}



</script>