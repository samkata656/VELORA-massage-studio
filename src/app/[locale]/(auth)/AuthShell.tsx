import Image from "next/image";

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="container-x grid gap-10 py-12 md:grid-cols-2 md:items-center md:py-20">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-4xl md:text-5xl">{title}</h1>
        <p className="mb-8 mt-3 text-muted">{lead}</p>
        {children}
      </div>
      <div className="relative hidden aspect-[4/5] overflow-hidden rounded-3xl md:block">
        <Image src="/photos/room-linen.png" alt="" fill sizes="50vw" className="object-cover" />
      </div>
    </div>
  );
}
