<template>
  <div class="w-full h-[640px] flex md:flex-row flex-col">
    <ImagePicker class="flex-1" @imageChanged="value => image = value" />
    <TableRender class="flex-1" :image="image" />
  </div>

</template>

<script setup lang="ts">

const image = ref<string>('')
</script>