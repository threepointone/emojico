declare module "ico-endec" {
  interface IcoImage {
    width: number;
    height: number;
    data: Buffer;
    bpp: number;
  }

  export function encode(images: IcoImage[]): Buffer;
  export function decode(buffer: Buffer): IcoImage[];
}
