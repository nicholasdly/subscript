/** How people type time zones: `tokyo`, `PST`, `pacific time`. */
export type ZoneAlias = {
  readonly alias: string;
  readonly id: string;
};

function rows(id: string, aliases: readonly string[]): ZoneAlias[] {
  return aliases.map((alias) => ({ alias, id }));
}

export const ZONE_ALIASES: readonly ZoneAlias[] = [
  ...rows("pst", ["pst"]),
  ...rows("pdt", ["pdt"]),
  ...rows("mst", ["mst"]),
  ...rows("mdt", ["mdt"]),
  ...rows("cst", ["cst"]),
  ...rows("cdt", ["cdt"]),
  ...rows("est", ["est"]),
  ...rows("edt", ["edt"]),
  ...rows("akst", ["akst"]),
  ...rows("akdt", ["akdt"]),
  ...rows("hst", ["hst"]),
  ...rows("bst", ["bst"]),

  ...rows("america-los-angeles", [
    "pacific time",
    "pt",
    "los angeles",
    "la",
    "san francisco",
    "sf",
    "seattle",
  ]),
  ...rows("america-denver", ["mountain time", "mt", "denver"]),
  ...rows("america-chicago", ["central time", "ct", "chicago"]),
  ...rows("america-new-york", [
    "eastern time",
    "et",
    "new york",
    "nyc",
    "usa",
    "us",
    "united states",
  ]),
  ...rows("america-anchorage", ["alaska time", "anchorage", "alaska"]),
  ...rows("pacific-honolulu", ["hawaii time", "honolulu", "hawaii"]),
  ...rows("america-phoenix", ["phoenix", "arizona"]),
  ...rows("america-toronto", ["toronto", "ottawa", "canada"]),
  ...rows("america-vancouver", ["vancouver"]),
  ...rows("america-mexico-city", ["mexico city", "mexico"]),
  ...rows("america-sao-paulo", ["sao paulo", "s\u00e3o paulo", "brazil"]),
  ...rows("asia-tokyo", ["tokyo", "japan", "jst"]),
  ...rows("asia-kolkata", [
    "ist",
    "india",
    "kolkata",
    "mumbai",
    "delhi",
    "bangalore",
    "bengaluru",
    "blr",
  ]),
  ...rows("asia-shanghai", ["china", "beijing", "shanghai"]),
  ...rows("asia-singapore", ["singapore"]),
  ...rows("asia-hong-kong", ["hong kong"]),
  ...rows("asia-seoul", ["seoul", "korea", "south korea"]),
  ...rows("asia-dubai", ["dubai"]),
  ...rows("asia-jerusalem", ["jerusalem", "israel"]),
  ...rows("asia-kathmandu", ["kathmandu", "nepal"]),
  ...rows("australia-sydney", ["sydney", "melbourne", "australia"]),
  ...rows("pacific-auckland", ["auckland", "new zealand"]),
  ...rows("europe-london", [
    "london",
    "uk",
    "britain",
    "england",
    "united kingdom",
    "british time",
  ]),
  ...rows("europe-paris", ["paris", "france"]),
  ...rows("europe-berlin", ["berlin", "germany"]),
  ...rows("europe-dublin", ["dublin", "ireland"]),
  ...rows("europe-rome", ["rome", "italy"]),
  ...rows("europe-moscow", ["moscow"]),
  ...rows("africa-cairo", ["cairo", "egypt"]),
  ...rows("africa-johannesburg", ["johannesburg", "south africa"]),
];
