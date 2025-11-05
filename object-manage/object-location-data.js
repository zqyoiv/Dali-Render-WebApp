const LocationData = {
  "M": ["M1", "M2", "M3", "M4", "M5", "M6"],
  "B": ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "B9", "B10"],
  "RM": ["RM1", "RM2"],
  "RC": ["RC1", "RC2"],
  "H1": ["H1"],
  "H2": ["H2"],
}

const ObjectLocationData = {
  "1": { name: "HandButterfly", location: ["M", "RM"] },
  "2": { name: "FlowerInsect1", location: ["M", "RC"] },
  "3": { name: "BreadHead", location: ["M", "B", "RM"] },
  "4": { name: "HeadDrawer", location: ["M", "B", "RM"] },
  "5": { name: "ShelReal", location: ["M", "B", "RM"] },
  "6": { name: "TreeHole", location: ["B"] },
  "7": { name: "BreadKey", location: ["M", "B"] },
  "8": { name: "LobsterKey", location: ["M", "RC"] },
  "9": { name: "EggHand", location: ["M", "RM"] },
  "10": { name: "Giraffe+Tire", location: ["B"] },
  "11": { name: "Skeleton", location: ["M", "RM"] },
  "12": { name: "HighheelCrutch", location: ["M", "RM"] },
  "13": { name: "FlowerWoman", location: ["M", "B", "RM"] },
  "14": { name: "FlowerInsect2", location: ["M", "RC"] },
  "15": { name: "ThumbClock", location: ["M", "RM"] },
  "16": { name: "EggEye", location: ["M", "RM"] },
  "17": { name: "BellTower", location: ["B"] },
  "18": { name: "LobsterSaxophone", location: ["M", "RM"] },
  "19": { name: "SpoonChair", location: ["M", "B"] },
  "20": { name: "CupAnt", location: ["M", "RC"] },
  "21": { name: "EggString", location: ["H1", "H2"] },
  "22": { name: "EyelashFlower", location: ["M", "RM"] },
  "23": { name: "WheelbarrowClock", location: ["M", "B"] },
  "24": { name: "ElephantLongLeg", location: ["B"] },
  "25": { name: "UpSofa", location: ["M", "B"] },
  "26": { name: "SpoonMoon", location: ["M", "RC"] },
  "27": { name: "LobsterChair", location: ["M", "B"] },
  "28": { name: "HandTree", location: ["M", "B"] },
  "29": { name: "CabinetKeyhole", location: ["M", "B"] },
  "30": { name: "PianoWater", location: ["M", "B"] }
}

/**
 * PRIORITIZED POSITION MAP
 * Maps specific object IDs to preferred location types (M, B, etc.)
 * Objects in this map will prioritize locations of the specified type
 * before falling back to their normal valid locations
 */
const PrioritizedPositionMap = {
    "3": "M",
    "4": "M", 
    "5": "M",
    "7": "M",
    "11": "M",
    "12": "M",
    "13": "M",
    "15": "M",
    "18": "M",
    "19": "B",
    "23": "M",
    "26": "M",
    "28": "M"
};

const ExampleGardenData = {
  objects: ["1", "2"], // max 22 object ids
  locations: ["M1", "RC1"], // max 22 location ids
}

module.exports = {
  LocationData,
  ObjectLocationData,
  PrioritizedPositionMap,
  ExampleGardenData
};