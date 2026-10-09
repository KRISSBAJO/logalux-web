import "../journal-admin.css";
import Link from "next/link";
import { Content, Flash, Topbar, statusPill } from "@/components/admin-ui";
import { can, getAdmin, load, type Row } from "@/lib/admin-api";
import { ArticleEditor } from "../editor";

export default async function EditArticle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // The admin list carries every field, and the contract has no single read, so the article is picked out of it.
  const [admin, res] = await Promise.all([getAdmin(), load("/journal")]);
  const article: Row | undefined = (res.data.articles ?? []).find((a: Row) => a.id === id);
  const back = `/admin/journal/${id}`;

  if (!article) {
    return (
      <>
        <Topbar title="Article" />
        <Content>
          <Flash sp={sp} error={res.error || "Article not found. It may have been deleted."} />
          <Link href="/admin/journal" className="text-[14px] font-semibold text-wine">Back to the Journal</Link>
        </Content>
      </>
    );
  }

  return (
    <>
      <Topbar title={article.title} sub={`/journal/${article.slug} · ${article.category_label ?? article.category} · ${article.country || "both countries"}`}>
        {statusPill(article.status)}
        <Link href="/admin/journal" className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13.5px] font-semibold hover:border-ink">All articles</Link>
      </Topbar>
      <Content>
        <Flash sp={sp} />
        <ArticleEditor key={`${article.id}:${article.updated_at ?? ""}`} article={article} canWrite={can(admin, "ops")} canPublish={can(admin, "super_admin")} back={back} />
      </Content>
    </>
  );
}
