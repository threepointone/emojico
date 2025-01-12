declare module "to-ico" {
  function toIco(input: Buffer[]): Promise<Buffer>;
  export default toIco;
}
