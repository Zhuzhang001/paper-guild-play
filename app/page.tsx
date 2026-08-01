import { PaperGuildGame } from "./PaperGuildGame";
import { PwaBootstrap } from "./PwaBootstrap";
import { ViewportController } from "./ViewportController";

export default function Home() {
  return (
    <>
      <ViewportController />
      <PaperGuildGame />
      <PwaBootstrap />
    </>
  );
}
