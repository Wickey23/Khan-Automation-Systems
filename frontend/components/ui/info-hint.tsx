"use client";

type InfoHintProps = {
  text: string;
  className?: string;
};

export function InfoHint({ text, className = "" }: InfoHintProps) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] font-semibold leading-none text-muted-foreground ${className}`}
      title={text}
      aria-label={text}
      role="img"
    >
      i
    </span>
  );
}

