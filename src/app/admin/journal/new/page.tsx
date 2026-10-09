import "../journal-admin.css";
import Link from "next/link";
import { Content, Flash, ReadOnly, Topbar } from "@/components/admin-ui";
import { can, getAdmin } from "@/lib/admin-api";
import { ArticleEditor } from "../editor";

export default async function NewArticle({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [sp, admin] = await Promise.all([searchParams, getAdmin()]);
  const ops = can(admin, "ops");
  return (
    <>
      <Topbar title="Write an article" sub="It starts as a draft. Nothing shows on the site until a super admin publishes it.">
        <Link href="/admin/journal" className="text-[13px] font-semibold text-muted hover:text-ink">All articles</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        {!ops ? <ReadOnly need="ops" /> : <ArticleEditor key="new" article={null} canWrite={ops} canPublish={can(admin, "super_admin")} back="/admin/journal/new" />}
      </Content>
    </>
  );
}
