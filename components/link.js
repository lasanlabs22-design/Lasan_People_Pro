import NextLink from "next/link";
import { NavPending } from "./nav-pending";

/** next/link plus the top progress bar while the destination is loading. */
export default function Link({ children, ...props }) {
  return (
    <NextLink {...props}>
      {children}
      <NavPending />
    </NextLink>
  );
}
