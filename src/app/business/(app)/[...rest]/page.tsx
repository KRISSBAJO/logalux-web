import { notFound } from "next/navigation";

/** Any address under /business that is not a screen shows the console's own not-found page, inside the shell. */
export default function NoScreen() {
  notFound();
}
