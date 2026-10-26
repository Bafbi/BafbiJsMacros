export interface Waypoint {
  x: number;
  y: number;
  z: number;
}

export interface PathData {
  name: string;
  waypoints: Waypoint[];
}

export type ReplaySpeed = "walk" | "sprint";
