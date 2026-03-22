export function homedir(): string {
  return "/";
}

const shim = {
  homedir,
};

export default shim;
