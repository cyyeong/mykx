/* Art in public/art ships pre-optimised as `<name>.webp` (1600w) and `<name>-800.webp`,
   so a plain <img> with srcset beats re-encoding through next/image. */
type ArtProps = Omit<React.ComponentProps<"img">, "src" | "srcSet"> & {
  /** Path without extension, e.g. "/art/kix/terrarium". */
  base: string;
};

export function Art({ base, alt, sizes = "100vw", ...rest }: ArtProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${base}-800.webp`}
      srcSet={`${base}-800.webp 800w, ${base}.webp 1600w`}
      sizes={sizes}
      alt={alt}
      decoding="async"
      {...rest}
    />
  );
}
