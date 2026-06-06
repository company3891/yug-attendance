import { getCurrentUser } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { FaceSetupClient } from './face-setup-client'

export default async function FaceSetupPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/login')

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <FaceSetupClient
        userId={me.id}
        userName={me.name}
        hasExistingDescriptors={!!me.face_descriptors}
        faceAuthEnabled={me.face_auth_enabled ?? false}
        imageConsent={me.face_image_consent ?? false}
        faceRegisteredAt={me.face_registered_at ?? null}
      />
    </main>
  )
}
