type ZipFrameProps = {
  folder: string;
  title: string;
  exact?: boolean;
};

export function ZipFrame({ folder, title, exact = false }: ZipFrameProps) {
  if (exact) {
    return (
      <iframe
        title={title}
        src={`/stitch2/${folder}/code.html`}
        className="h-screen w-full border-0"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <iframe
        title={title}
        src={`/stitch2/${folder}/code.html`}
        className="h-[calc(100vh-170px)] w-full min-h-[900px] border-0"
      />
    </div>
  );
}
