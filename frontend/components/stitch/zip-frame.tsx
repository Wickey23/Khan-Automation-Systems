type ZipFrameProps = {
  folder: string;
  title: string;
  exact?: boolean;
};

export function ZipFrame({ folder, title, exact = false }: ZipFrameProps) {
  if (exact) {
    return (
      <div className="relative bg-[#f7f9fb]">
        <img
          src={`/stitch2/${folder}/screen.png`}
          alt={title}
          className="block h-auto w-full"
        />
        <a
          href={`/stitch2/${folder}/code.html`}
          target="_blank"
          rel="noreferrer"
          className="absolute right-4 top-4 rounded-md bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
        >
          Open interactive prototype
        </a>
      </div>
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
