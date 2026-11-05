export type Media = {
  id: number;
  url: string;
  kind: "image" | "video";
};

export type Spot = {
  id: number;
  lat: number;
  lng: number;
  name: string;
  region: string | null;
  fishMost: string | null;
  fishMid: string | null;
  fishLeast: string | null;
  bait: string;
  times: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
  media: Media[];
};
