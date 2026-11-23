export type Saver = (data: Blob, filename: string) => Promise<void>;

const browserSave: Saver = async (data, filename) => {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

let saver: Saver = browserSave;
/** Replace how files are handed to the user (the Claude artifact asks the host to save). */
export const setSaver = (s: Saver) => { saver = s; };
export const saveFile = (data: Blob, filename: string) => saver(data, filename);
