import { redirect } from "next/navigation";

// De weekpagina is opgegaan in het logboek.
export default function WeekRedirect() {
  redirect("/logboek");
}
