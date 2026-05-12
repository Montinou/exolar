import { UserProfile } from "@clerk/nextjs"
import { PageContainer, PageHeader } from "@/components/shell"

export default function AccountPage() {
  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Account"
        title="Profile and security"
        lede="Update your personal info, password, connected accounts, and active sessions."
      />
      <UserProfile routing="path" path="/account" />
    </PageContainer>
  )
}
