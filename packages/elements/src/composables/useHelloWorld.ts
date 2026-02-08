import type { ComputedRef, Ref } from 'vue'
import { computed, ref } from 'vue'

export interface UseHelloWorldReturn {
  name: Ref<string>
  greeting: ComputedRef<string>
  setName: (next: string) => void
  reset: () => void
  shout: (upper?: boolean) => string
}

/**
 * useHelloWorld - 简单的问候组合式函数
 * @param initialName 初始名称，默认 "World"
 */
export function useHelloWorld(initialName = 'World'): UseHelloWorldReturn {
  const name = ref<string>(initialName)

  const greeting = computed(() => `Hello, ${name.value}!`)

  function setName(next: string) {
    name.value = next
  }

  function reset() {
    name.value = initialName
  }

  function shout(upper = true) {
    return upper ? greeting.value.toUpperCase() : greeting.value
  }

  return {
    name,
    greeting,
    setName,
    reset,
    shout,
  }
}

export default useHelloWorld
