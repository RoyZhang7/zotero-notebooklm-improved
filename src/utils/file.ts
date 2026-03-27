export async function readFileAsBase64(filePath: string): Promise<string> {
  const data = await IOUtils.read(filePath);
  // Convert Uint8Array to base64
  let binary = "";
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}
