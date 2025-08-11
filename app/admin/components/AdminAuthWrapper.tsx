'use client'

import { useRouter } from 'next/navigation'
import { AdminAuth } from './AdminAuth'

export function AdminAuthWrapper() {
  const router = useRouter()
  
  const handleAuthSuccess = () => {
    // Redirect to admin dashboard after successful authentication
    router.push('/admin')
  }

  return <AdminAuth onAuthSuccess={handleAuthSuccess} />
}
