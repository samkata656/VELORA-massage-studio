/** Renders article text: blank-line separated paragraphs, lines starting with "- " become a list. */
export function ArticleBody({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="prose-velora">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim());
        if (lines.every((l) => l.startsWith("- ") || l.startsWith("* ")))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
