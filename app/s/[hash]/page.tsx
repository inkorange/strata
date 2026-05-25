import { redirect } from 'next/navigation'

// Real share-link decoder lands when sceneSlice + history slice come
// online. For now, /s/[hash] silently bounces back to the hub so any
// shared link a user attempts is at least a valid landing.
export default function SharedScene() {
  redirect('/')
}
