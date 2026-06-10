---
layout: page
---

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const browserLang = navigator.language.toLowerCase()

  if (browserLang.startsWith('ko')) {
    window.location.replace('/ko/guide/')
  } else {
    window.location.replace('/en/guide/')
  }
})
</script>
