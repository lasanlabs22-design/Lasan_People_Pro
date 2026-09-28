import { load } from "@/lib/api";
import { PageHeader } from "@/components/ui";
import { DirectoryList } from "./directory-list";

export const metadata = { title: "Directory" };

export default async function DirectoryPage() {
  const [{ people }, { user, tenant }] = await Promise.all([load("/directory"), load("/auth/me")]);
  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Directory"
        description={`Everyone at ${tenant.name}, with their role, department and work email.`}
      />
      <DirectoryList people={people} meId={user.id} />
    </>
  );
}
