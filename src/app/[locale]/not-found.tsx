import Link from "next/link";
import { getDictionary } from "@/i18n";

export default function NotFound() {
  const t = getDictionary("bg");
  const en = getDictionary("en");
  return (
    <div className="container-x py-28 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-4 text-5xl">{t.errors.notFound}</h1>
      <p className="mt-3 text-muted">
        {t.errors.notFoundText} · {en.errors.notFoundText}
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        {t.errors.goHome}
      </Link>
    </div>
  );
}
