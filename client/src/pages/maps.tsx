
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { supabase, isSupabaseConfigured, getErrorMessage, type MapFeature } from "@/lib/supabase";
import { Header } from "@/components/header";
import { BackgroundPattern } from "@/components/background-pattern";
import { LoadingSpinner } from "@/components/loading-spinner";
import {
  Map as MapIcon,
  Layers,
  AlertTriangle,
  Mountain,
  Landmark,
  Navigation,
  Building,
  Compass,
  ChevronRight,
  ChevronDown,
  X,
  Search,
  Ruler,
  Printer,
  Crosshair,
  FileText,
  Image as ImageIcon,
  File,
  FolderOpen,
  Globe,
  MapPinned,
  Plus,
  Square,
  Circle,
  Download,
  Save,
  Trash2,
  ZoomIn,
  ZoomOut,
  Copy,
} from "lucide-react";
// @ts-ignore
import { Pannellum } from "pannellum-react";
import "pannellum/build/pannellum.css";
import type {
  MapLayer,
  HazardZone,
  MapAsset,
  DriveFolder,
  DriveFile,
  GoogleOpenMap,
} from "@shared/schema";


const GOOGLE_OPEN_MAPS: GoogleOpenMap[] = [
  {
    id: "evac-centers",
    name: "Evacuation Centers",
    iframeSrc:
      "https://www.google.com/maps/d/embed?mid=1mjXfpYAmLEhG2U2Gu9VWjRdcuI9H4kw&ehbc=2E312F",
  },
  {
    id: "hazard-zones",
    name: "Hazard Zones",
    iframeSrc:
      "https://www.google.com/maps/d/embed?mid=17JUWx271jjwJNBN2yVStmAPY_Y_iQOg&ehbc=2E312F",
  },
  {
    id: "response-routes",
    name: "Response Routes",
    iframeSrc:
      "https://www.google.com/maps/d/embed?mid=1WqlvA465RCv29U-MyWi-1qU1MljXgAU&ehbc=2E312F",
  },
];

const DEFAULT_MAP_EMBED =
  "https://www.google.com/maps/d/embed?mid=1BmibV2upcL5kwmEKIJPLfit7VNQAqk0&ehbc=2E312F&noprof=1";

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const MAP_LAYERS: MapLayer[] = [
  {
    id: "interactive",
    name: "Interactive Map",
    type: "interactive",
    active: true,
  },
  {
    id: "administrative",
    name: "Administrative Map",
    type: "administrative",
    active: false,
  },
  {
    id: "topographic",
    name: "Topographic Map",
    type: "topographic",
    active: false,
  },
  { id: "land-use", name: "Land Use Map", type: "land-use", active: false },
  { id: "hazards", name: "Hazards Maps", type: "hazards", active: false },
  { id: "other", name: "Other Map", type: "other", active: false },
  { id: "panorama", name: "Panorama", type: "panorama", active: false },
  {
    id: "google-open",
    name: "Google Open Map",
    type: "google-open",
    active: false,
  },
];

const layerIcons: Record<string, any> = {
  interactive: Compass,
  administrative: Building,
  topographic: Mountain,
  "land-use": Landmark,
  hazards: AlertTriangle,
  other: MapPinned,
  panorama: Globe,
  "google-open": Globe,
};

const getLayerApiEndpoint = (type: string): string | null => {
  switch (type) {
    case "administrative":
      return "/api/maps/administrative";
    case "topographic":
      return "/api/maps/topographic";
    case "land-use":
      return "/api/maps/land-use";
    case "hazards":
      return "/api/maps/hazards-files";
    case "panorama":
      return "/api/maps/panorama";
    case "other":
      return "/api/maps/other";
    default:
      return null;
  }
};

const getFileIcon = (mimeType: string) => {
  if (mimeType.includes("image")) return ImageIcon;
  if (mimeType.includes("pdf") || mimeType.includes("document"))
    return FileText;
  return File;
};


// Feature types for drawing are now imported from supabase.ts

export default function Maps() {
  const [layers, setLayers] = useState<MapLayer[]>(MAP_LAYERS);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [selectedGoogleMap, setSelectedGoogleMap] =
    useState<GoogleOpenMap | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mouseCoords, setMouseCoords] = useState({
    lat: 13.0752,
    lng: 123.5298,
  });
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [subfolderContents, setSubfolderContents] = useState<
    Record<string, DriveFolder>
  >({});
  const [loadingSubfolder, setLoadingSubfolder] = useState<string | null>(null);
  const [mapFeatures, setMapFeatures] = useState<MapFeature[]>([]);
  const [drawingMode, setDrawingMode] = useState<
    "marker" | "polygon" | "line" | null
  >(null);
  const [tempCoordinates, setTempCoordinates] = useState<
    { lat: number; lng: number }[]
  >([]);
  const [selectedColor, setSelectedColor] = useState("#FF0000");
  const [selectedFillColor, setSelectedFillColor] = useState("#FF000040");
  const [selectedWeight, setSelectedWeight] = useState(3);
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [showLegend, setShowLegend] = useState(true);
  const [mapZoom, setMapZoom] = useState(12);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [modalImageName, setModalImageName] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const queryClient = useQueryClient();


  useEffect(() => {
    const loadFeatures = async () => {
      // Check if Supabase is properly configured
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured - map features will not be saved');
        return;
      }

      try {
        const { data, error } = await supabase
          .from('map_features')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Supabase error loading features:', error);
          return;
        }

        if (data) {
          const features: MapFeature[] = data.map((f) => ({
            id: f.id,
            type: f.type,
            coordinates: f.coordinates,
            title: f.title,
            description: f.description || undefined,
            color: f.color,
            fillColor: f.fill_color || undefined,
            weight: f.weight || undefined,
          }));
          setMapFeatures(features);
        }
      } catch (error) {
        console.error('Error loading map features:', getErrorMessage(error));
      }
    };

    loadFeatures();
  }, []);


  const saveFeatureToDb = async (feature: MapFeature) => {
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - feature will not be saved to database');
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.warn('Auth error (features will be saved without user):', authError);
      }

      const { error } = await supabase
        .from('map_features')
        .insert({
          id: feature.id,
          type: feature.type,
          coordinates: feature.coordinates,
          title: feature.title,
          description: feature.description || null,
          color: feature.color,
          fill_color: feature.fillColor || null,
          weight: feature.weight || null,
          created_by: user?.id || null,
        });

      if (error) {
        console.error('Supabase error saving feature:', error);
      }
    } catch (error) {
      console.error('Error saving feature:', getErrorMessage(error));
    }
  };


  const deleteFeatureFromDb = async (id: string) => {
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - feature will not be deleted from database');
      return;
    }

    try {
      const { error } = await supabase
        .from('map_features')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting feature:', error);
      }
    } catch (error) {
      console.error('Error deleting feature:', getErrorMessage(error));
    }
  };


  const clearAllFeaturesFromDb = async () => {
    // Check if Supabase is properly configured
    if (!isSupabaseConfigured()) {
      console.warn('Supabase not configured - features will not be cleared from database');
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.warn('Auth error (cannot clear user-specific features):', authError);
        return;
      }

      if (user) {
        const { error } = await supabase
          .from('map_features')
          .delete()
          .eq('created_by', user.id);

        if (error) {
          console.error('Supabase error clearing features:', error);
        }
      }
    } catch (error) {
      console.error('Error clearing features:', getErrorMessage(error));
    }
  };

  const { data: hazardZones = [] } = useQuery<HazardZone[]>({
    queryKey: ["/api/maps/hazards"],
  });

  const { data: assets = [] } = useQuery<MapAsset[]>({
    queryKey: ["/api/maps/assets"],
  });

  const activeLayer = useMemo(() => layers.find((l) => l.active), [layers]);
  const layerEndpoint = activeLayer
    ? getLayerApiEndpoint(activeLayer.type)
    : null;

  const { data: layerFolders = [], isLoading: foldersLoading } = useQuery<
    DriveFolder[]
  >({
    queryKey: [layerEndpoint],
    enabled: !!layerEndpoint,
  });

  const loadSubfolderContents = useCallback(
    async (folderId: string) => {
      if (subfolderContents[folderId]) return;

      setLoadingSubfolder(folderId);
      try {
        const response = await fetch(`/api/maps/subfolder/${folderId}`);
        if (response.ok) {
          const data = await response.json();
          setSubfolderContents((prev) => ({ ...prev, [folderId]: data }));
        }
      } catch (error) {
        console.error("Failed to load subfolder:", error);
      } finally {
        setLoadingSubfolder(null);
      }
    },
    [subfolderContents],
  );

  const toggleLayer = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        active: l.id === layerId,
      })),
    );
    setExpandedFolders(new Set());
    setSelectedFile(null);
    setSelectedGoogleMap(null);
    setSubfolderContents({});
  }, []);

  const toggleFolder = useCallback(
    (folderId: string, hasSubfolders?: boolean) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
          if (hasSubfolders) {
            loadSubfolderContents(folderId);
          }
        }
        return next;
      });
    },
    [loadSubfolderContents],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mapRef.current) return;

    const rect = mapRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Convert normalized coordinates to lat/lng
    const lat = 13.0752 + (0.5 - y) * 0.1;
    const lng = 123.5298 + (x - 0.5) * 0.1;

    setMouseCoords({ lat, lng });
  }, []);

  const handleMapClick = useCallback(
    (e: React.MouseEvent) => {
      if (!mapRef.current || !drawingMode) return;

      const rect = mapRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Convert normalized coordinates to lat/lng
      const lat = 13.0752 + (0.5 - y) * 0.1;
      const lng = 123.5298 + (x - 0.5) * 0.1;

      if (drawingMode === "marker") {
        const newFeature: MapFeature = {
          id: `marker-${Date.now()}`,
          type: "marker",
          coordinates: [{ lat, lng }],
          title: featureTitle || "New Marker",
          description: featureDescription,
          color: selectedColor,
        };
        setMapFeatures((prev) => [...prev, newFeature]);
        saveFeatureToDb(newFeature);
        setDrawingMode(null);
        setFeatureTitle("");
        setFeatureDescription("");
      } else if (drawingMode === "polygon" || drawingMode === "line") {
        setTempCoordinates((prev) => [...prev, { lat, lng }]);
      }
    },
    [drawingMode, featureTitle, featureDescription, selectedColor],
  );

  const finishDrawing = useCallback(() => {
    if (tempCoordinates.length === 0) return;

    if (drawingMode === "polygon" && tempCoordinates.length >= 3) {
      const newFeature: MapFeature = {
        id: `polygon-${Date.now()}`,
        type: "polygon",
        coordinates: [...tempCoordinates],
        title: featureTitle || "New Polygon",
        description: featureDescription,
        color: selectedColor,
        fillColor: selectedFillColor,
      };
      setMapFeatures((prev) => [...prev, newFeature]);
      saveFeatureToDb(newFeature);
    } else if (drawingMode === "line" && tempCoordinates.length >= 2) {
      const newFeature: MapFeature = {
        id: `line-${Date.now()}`,
        type: "line",
        coordinates: [...tempCoordinates],
        title: featureTitle || "New Line",
        description: featureDescription,
        color: selectedColor,
        weight: selectedWeight,
      };
      setMapFeatures((prev) => [...prev, newFeature]);
      saveFeatureToDb(newFeature);
    }

    setTempCoordinates([]);
    setDrawingMode(null);
    setFeatureTitle("");
    setFeatureDescription("");
  }, [
    drawingMode,
    tempCoordinates,
    featureTitle,
    featureDescription,
    selectedColor,
    selectedFillColor,
    selectedWeight,
  ]);

  const cancelDrawing = useCallback(() => {
    setDrawingMode(null);
    setTempCoordinates([]);
  }, []);

  const deleteFeature = useCallback((id: string) => {
    setMapFeatures((prev) => prev.filter((feature) => feature.id !== id));
    deleteFeatureFromDb(id);
  }, []);

  const clearAllFeatures = useCallback(() => {
    setMapFeatures([]);
    clearAllFeaturesFromDb();
  }, []);

  const handleLocateMe = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMouseCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error.message);
        },
      );
    }
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const openImageModal = useCallback((imageUrl: string, imageName: string) => {
    setModalImageUrl(imageUrl);
    setModalImageName(imageName);
    setImageModalOpen(true);
  }, []);

  const closeImageModal = useCallback(() => {
    setImageModalOpen(false);
    setModalImageUrl("");
    setModalImageName("");
  }, []);

  const handleCopyImage = useCallback(async () => {
    if (!modalImageUrl) return;

    try {
      const response = await fetch(modalImageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      alert("Image copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy image:", error);
      alert("Failed to copy image. Please try again.");
    }
  }, [modalImageUrl]);

  const handleDownloadImage = useCallback(() => {
    if (!modalImageUrl) return;

    const link = document.createElement("a");
    link.href = modalImageUrl;
    link.download = modalImageName || "image.jpg";
    link.click();
  }, [modalImageUrl, modalImageName]);

  const handlePrintImage = useCallback(() => {
    if (!imageRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print ${modalImageName}</title>
          <style>
            body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
            img { max-width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <img src="${modalImageUrl}" alt="${modalImageName}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [modalImageUrl, modalImageName]);

  const exportAsImage = useCallback(() => {
    if (!canvasRef.current || !mapRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = mapRef.current.clientWidth;
    canvas.height = mapRef.current.clientHeight;

    // Draw base map (simplified representation)
    const gradient = ctx.createLinearGradient(
      0,
      0,
      canvas.width,
      canvas.height,
    );
    gradient.addColorStop(0, "#1A1E32");
    gradient.addColorStop(0.5, "#0E2148");
    gradient.addColorStop(1, "#1A1E32");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw features
    mapFeatures.forEach((feature) => {
      if (feature.type === "marker" && feature.coordinates.length > 0) {
        const coord = feature.coordinates[0];
        // Convert lat/lng to pixel coordinates
        const x = ((coord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
        const y = (0.5 - (coord.lat - 13.0752) / 0.1) * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = feature.color;
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (
        feature.type === "polygon" &&
        feature.coordinates.length >= 3
      ) {
        ctx.beginPath();
        const firstCoord = feature.coordinates[0];
        const firstX = ((firstCoord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
        const firstY = (0.5 - (firstCoord.lat - 13.0752) / 0.1) * canvas.height;
        ctx.moveTo(firstX, firstY);

        for (let i = 1; i < feature.coordinates.length; i++) {
          const coord = feature.coordinates[i];
          const x = ((coord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
          const y = (0.5 - (coord.lat - 13.0752) / 0.1) * canvas.height;
          ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fillStyle = feature.fillColor || feature.color + "40";
        ctx.fill();
        ctx.strokeStyle = feature.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (feature.type === "line" && feature.coordinates.length >= 2) {
        ctx.beginPath();
        const firstCoord = feature.coordinates[0];
        const firstX = ((firstCoord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
        const firstY = (0.5 - (firstCoord.lat - 13.0752) / 0.1) * canvas.height;
        ctx.moveTo(firstX, firstY);

        for (let i = 1; i < feature.coordinates.length; i++) {
          const coord = feature.coordinates[i];
          const x = ((coord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
          const y = (0.5 - (coord.lat - 13.0752) / 0.1) * canvas.height;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = feature.color;
        ctx.lineWidth = feature.weight || 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();
      }
    });

    // Draw temporary coordinates
    if (tempCoordinates.length > 0) {
      tempCoordinates.forEach((coord, index) => {
        const x = ((coord.lng - 123.5298) / 0.1 + 0.5) * canvas.width;
        const y = (0.5 - (coord.lat - 13.0752) / 0.1) * canvas.height;

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = selectedColor;
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    // Export as image
    const link = document.createElement("a");
    link.download = "map-export.jpg";
    link.href = canvas.toDataURL("image/jpeg", 0.9);
    link.click();
  }, [mapFeatures, tempCoordinates, selectedColor]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return layerFolders;
    const query = searchQuery.toLowerCase();
    return layerFolders
      .map((folder) => ({
        ...folder,
        files:
          folder.files?.filter((f) => f.name.toLowerCase().includes(query)) ||
          [],
      }))
      .filter(
        (folder) =>
          folder.name.toLowerCase().includes(query) ||
          (folder.files && folder.files.length > 0),
      );
  }, [layerFolders, searchQuery]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#1A1E32" }}
    >
      <BackgroundPattern />
      <Header title="MDRRMO Pio Duran Maps" showBack />

      <main className="flex-1 relative z-10 flex overflow-hidden">
        <div
          className={`absolute lg:relative z-20 h-full transition-all duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:-translate-x-full"}`}
          style={{ width: sidebarOpen ? "300px" : "0" }}
        >
          <div
            className="h-full flex flex-col overflow-hidden"
            style={{
              background: "rgba(14, 33, 72, 0.85)",
              backdropFilter: "blur(25px)",
              borderRight: "1px solid rgba(121, 101, 193, 0.4)",
            }}
          >
            <div
              className="p-4 border-b"
              style={{ borderColor: "rgba(121, 101, 193, 0.3)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="font-bold flex items-center gap-2"
                  style={{ color: "#E3D095" }}
                >
                  <Layers className="w-5 h-5" style={{ color: "#F74B8A" }} />
                  Map Layers
                </h3>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-lg"
                  style={{ color: "#E3D095" }}
                  data-testid="button-close-sidebar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2">
                {layers.map((layer) => {
                  const Icon = layerIcons[layer.type] || MapIcon;
                  const isActive = layer.active;
                  const hasSubfolders =
                    layerEndpoint && isActive && filteredFolders.length > 0;

                  return (
                    <div key={layer.id}>
                      <button
                        onClick={() => toggleLayer(layer.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                          isActive ? "" : "hover-elevate"
                        }`}
                        style={{
                          background: isActive
                            ? "linear-gradient(135deg, #00A38D, #00A38DCC)"
                            : "rgba(255, 255, 255, 0.05)",
                          color: isActive ? "white" : "#E3D095",
                          boxShadow: isActive
                            ? "0 8px 24px rgba(0, 163, 141, 0.4)"
                            : "none",
                        }}
                        data-testid={`layer-${layer.id}`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium text-sm flex-1 text-left">
                          {layer.name}
                        </span>
                        {isActive && <ChevronRight className="w-4 h-4" />}
                      </button>

                      {hasSubfolders && (
                        <div className="mt-2 ml-4 space-y-1">
                          {filteredFolders.map((folder) => (
                            <div key={folder.id}>
                              <button
                                onClick={() =>
                                  toggleFolder(
                                    folder.id,
                                    (folder.subfolders?.length || 0) > 0,
                                  )
                                }
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover-elevate"
                                style={{
                                  color: "rgba(227, 208, 149, 0.9)",
                                  background: expandedFolders.has(folder.id)
                                    ? "rgba(0, 163, 141, 0.2)"
                                    : "transparent",
                                }}
                                data-testid={`folder-${folder.id}`}
                              >
                                {expandedFolders.has(folder.id) ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                                <FolderOpen
                                  className="w-4 h-4"
                                  style={{ color: "#00A38D" }}
                                />
                                <span className="truncate flex-1 text-left">
                                  {folder.name}
                                </span>
                                {folder.files && (
                                  <span className="text-xs opacity-60">
                                    ({folder.files.length})
                                  </span>
                                )}
                              </button>

                              {expandedFolders.has(folder.id) &&
                                folder.files && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {folder.files.map((file) => {
                                      const FileIcon = getFileIcon(
                                        file.mimeType,
                                      );
                                      return (
                                        <button
                                          key={file.id}
                                          onClick={() => setSelectedFile(file)}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover-elevate text-left"
                                          style={{
                                            color: "rgba(227, 208, 149, 0.7)",
                                            background:
                                              selectedFile?.id === file.id
                                                ? "rgba(247, 75, 138, 0.2)"
                                                : "transparent",
                                          }}
                                          data-testid={`file-${file.id}`}
                                        >
                                          <FileIcon className="w-3 h-3 flex-shrink-0" />
                                          <span className="truncate">
                                            {file.name}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}

                              {expandedFolders.has(folder.id) &&
                                folder.subfolders &&
                                folder.subfolders.length > 0 && (
                                  <div className="ml-6 mt-1 space-y-1">
                                    {folder.subfolders.map((subfolder) => (
                                      <div key={subfolder.id}>
                                        <button
                                          onClick={() =>
                                            toggleFolder(subfolder.id, true)
                                          }
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover-elevate"
                                          style={{
                                            color: "rgba(227, 208, 149, 0.7)",
                                            background: expandedFolders.has(
                                              subfolder.id,
                                            )
                                              ? "rgba(0, 163, 141, 0.15)"
                                              : "transparent",
                                          }}
                                          data-testid={`subfolder-${subfolder.id}`}
                                        >
                                          {expandedFolders.has(subfolder.id) ? (
                                            <ChevronDown className="w-3 h-3" />
                                          ) : (
                                            <ChevronRight className="w-3 h-3" />
                                          )}
                                          <FolderOpen
                                            className="w-3 h-3"
                                            style={{ color: "#00A38D" }}
                                          />
                                          <span className="truncate flex-1 text-left">
                                            {subfolder.name}
                                          </span>
                                          {loadingSubfolder ===
                                            subfolder.id && (
                                            <span
                                              className="animate-spin w-3 h-3 border border-t-transparent rounded-full"
                                              style={{ borderColor: "#00A38D" }}
                                            />
                                          )}
                                        </button>
                                        {expandedFolders.has(subfolder.id) &&
                                          subfolderContents[subfolder.id] && (
                                            <div className="ml-4 mt-1 space-y-1">
                                              {subfolderContents[
                                                subfolder.id
                                              ].files?.map((file) => {
                                                const FileIcon = getFileIcon(
                                                  file.mimeType,
                                                );
                                                return (
                                                  <button
                                                    key={file.id}
                                                    onClick={() =>
                                                      setSelectedFile(file)
                                                    }
                                                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover-elevate text-left"
                                                    style={{
                                                      color:
                                                        "rgba(227, 208, 149, 0.6)",
                                                      background:
                                                        selectedFile?.id ===
                                                        file.id
                                                          ? "rgba(247, 75, 138, 0.2)"
                                                          : "transparent",
                                                    }}
                                                  >
                                                    <FileIcon className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">
                                                      {file.name}
                                                    </span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                      )}

                      {layer.type === "google-open" && isActive && (
                        <div className="mt-2 ml-4 space-y-1">
                          {GOOGLE_OPEN_MAPS.map((gmap) => (
                            <button
                              key={gmap.id}
                              onClick={() => setSelectedGoogleMap(gmap)}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover-elevate"
                              style={{
                                color: "rgba(227, 208, 149, 0.9)",
                                background:
                                  selectedGoogleMap?.id === gmap.id
                                    ? "rgba(0, 163, 141, 0.2)"
                                    : "transparent",
                              }}
                              data-testid={`google-map-${gmap.id}`}
                            >
                              <Globe
                                className="w-4 h-4"
                                style={{ color: "#00A38D" }}
                              />
                              <span className="truncate">{gmap.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {activeLayer?.type === "hazards" && (
                <div
                  className="mt-6 p-4 rounded-xl"
                  style={{ background: "rgba(255, 255, 255, 0.05)" }}
                >
                  <h4
                    className="text-sm font-semibold mb-3"
                    style={{ color: "#E3D095" }}
                  >
                    Hazard Legend
                  </h4>
                  <div className="space-y-2">
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "rgba(227, 208, 149, 0.8)" }}
                    >
                      <span className="w-3 h-3 rounded-full bg-[#DC3545]" />{" "}
                      Flood-Prone Areas
                    </div>
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "rgba(227, 208, 149, 0.8)" }}
                    >
                      <span className="w-3 h-3 rounded-full bg-[#FFC107]" />{" "}
                      Landslide Zones
                    </div>
                    <div
                      className="flex items-center gap-2 text-xs"
                      style={{ color: "rgba(227, 208, 149, 0.8)" }}
                    >
                      <span className="w-3 h-3 rounded-full bg-[#007BFF]" />{" "}
                      Storm Surge Areas
                    </div>
                  </div>
                </div>
              )}

              <div
                className="mt-6 p-4 rounded-xl"
                style={{ background: "rgba(255, 255, 255, 0.05)" }}
              >
                <h4
                  className="text-sm font-semibold mb-3"
                  style={{ color: "#E3D095" }}
                >
                  Quick Stats
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="text-center p-3 rounded-lg"
                    style={{ background: "rgba(247, 75, 138, 0.15)" }}
                  >
                    <div
                      className="text-lg font-bold"
                      style={{ color: "#F74B8A" }}
                    >
                      {hazardZones.length}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(227, 208, 149, 0.6)" }}
                    >
                      Hazard Zones
                    </div>
                  </div>
                  <div
                    className="text-center p-3 rounded-lg"
                    style={{ background: "rgba(0, 163, 141, 0.15)" }}
                  >
                    <div
                      className="text-lg font-bold"
                      style={{ color: "#00A38D" }}
                    >
                      {assets.length}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: "rgba(227, 208, 149, 0.6)" }}
                    >
                      Assets
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-4 z-20 p-3 rounded-r-xl"
            style={{
              background: "rgba(14, 33, 72, 0.95)",
              color: "#E3D095",
              borderRight: "1px solid rgba(121, 101, 193, 0.4)",
              borderTop: "1px solid rgba(121, 101, 193, 0.4)",
              borderBottom: "1px solid rgba(121, 101, 193, 0.4)",
            }}
            data-testid="button-open-sidebar"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative flex flex-col">
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
            <div
              className="relative"
              style={{
                background: "rgba(14, 33, 72, 0.9)",
                backdropFilter: "blur(15px)",
                borderRadius: "40px",
                border: "2px solid rgba(121, 101, 193, 0.4)",
              }}
            >
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: "rgba(227, 208, 149, 0.6)" }}
              />
              <input
                type="text"
                placeholder="Search maps, places, documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent py-3 pl-12 pr-4 text-sm outline-none"
                style={{ color: "#E3D095" }}
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            {activeLayer?.type === "interactive" && (
              <>
                <button
                  onClick={() => setDrawingMode("marker")}
                  className={`p-3 rounded-full transition-all hover-elevate ${drawingMode === "marker" ? "ring-2 ring-white" : ""}`}
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    backdropFilter: "blur(15px)",
                    border: "1px solid rgba(121, 101, 193, 0.4)",
                    color: "#E3D095",
                  }}
                  title="Add Marker"
                  data-testid="button-add-marker"
                >
                  <MapPinned className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setDrawingMode("polygon")}
                  className={`p-3 rounded-full transition-all hover-elevate ${drawingMode === "polygon" ? "ring-2 ring-white" : ""}`}
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    backdropFilter: "blur(15px)",
                    border: "1px solid rgba(121, 101, 193, 0.4)",
                    color: "#E3D095",
                  }}
                  title="Draw Polygon"
                  data-testid="button-draw-polygon"
                >
                  <Square className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setDrawingMode("line")}
                  className={`p-3 rounded-full transition-all hover-elevate ${drawingMode === "line" ? "ring-2 ring-white" : ""}`}
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    backdropFilter: "blur(15px)",
                    border: "1px solid rgba(121, 101, 193, 0.4)",
                    color: "#E3D095",
                  }}
                  title="Draw Line"
                  data-testid="button-draw-line"
                >
                  <Ruler className="w-5 h-5" />
                </button>
                <button
                  onClick={exportAsImage}
                  className="p-3 rounded-full transition-all hover-elevate"
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    backdropFilter: "blur(15px)",
                    border: "1px solid rgba(121, 101, 193, 0.4)",
                    color: "#E3D095",
                  }}
                  title="Export as Image"
                  data-testid="button-export-image"
                >
                  <Download className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={handlePrint}
              className="p-3 rounded-full transition-all hover-elevate"
              style={{
                background: "rgba(14, 33, 72, 0.9)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(121, 101, 193, 0.4)",
                color: "#E3D095",
              }}
              title="Print Map"
              data-testid="button-print"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={handleLocateMe}
              className="p-3 rounded-full transition-all hover-elevate"
              style={{
                background: "rgba(14, 33, 72, 0.9)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(121, 101, 193, 0.4)",
                color: "#E3D095",
              }}
              title="My Location"
              data-testid="button-locate"
            >
              <Crosshair className="w-5 h-5" />
            </button>
          </div>

          {/* Drawing Controls */}
          {(drawingMode === "marker" ||
            drawingMode === "polygon" ||
            drawingMode === "line") && (
            <div
              className="absolute top-20 right-4 z-10 p-4 rounded-xl w-80"
              style={{
                background: "rgba(14, 33, 72, 0.95)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(121, 101, 193, 0.4)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold" style={{ color: "#E3D095" }}>
                  {drawingMode === "marker"
                    ? "Add Marker"
                    : drawingMode === "polygon"
                      ? "Draw Polygon"
                      : "Draw Line"}
                </h4>
                <button
                  onClick={cancelDrawing}
                  className="p-1 rounded"
                  style={{ color: "#E3D095" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "rgba(227, 208, 149, 0.7)" }}
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    value={featureTitle}
                    onChange={(e) => setFeatureTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(121, 101, 193, 0.3)",
                      color: "#E3D095",
                    }}
                    placeholder="Enter title"
                  />
                </div>

                <div>
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "rgba(227, 208, 149, 0.7)" }}
                  >
                    Description
                  </label>
                  <textarea
                    value={featureDescription}
                    onChange={(e) => setFeatureDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "rgba(255, 255, 255, 0.1)",
                      border: "1px solid rgba(121, 101, 193, 0.3)",
                      color: "#E3D095",
                    }}
                    placeholder="Enter description"
                    rows={2}
                  />
                </div>

                <div>
                  <label
                    className="block text-xs mb-1"
                    style={{ color: "rgba(227, 208, 149, 0.7)" }}
                  >
                    Color
                  </label>
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full h-10 rounded-lg"
                  />
                </div>

                {drawingMode === "polygon" && (
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgba(227, 208, 149, 0.7)" }}
                    >
                      Fill Color
                    </label>
                    <input
                      type="color"
                      value={selectedFillColor}
                      onChange={(e) => setSelectedFillColor(e.target.value)}
                      className="w-full h-10 rounded-lg"
                    />
                  </div>
                )}

                {drawingMode === "line" && (
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: "rgba(227, 208, 149, 0.7)" }}
                    >
                      Line Weight
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={selectedWeight}
                      onChange={(e) =>
                        setSelectedWeight(parseInt(e.target.value))
                      }
                      className="w-full"
                    />
                    <div
                      className="text-xs text-center mt-1"
                      style={{ color: "rgba(227, 208, 149, 0.7)" }}
                    >
                      {selectedWeight}px
                    </div>
                  </div>
                )}

                {drawingMode === "polygon" && tempCoordinates.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={finishDrawing}
                      disabled={tempCoordinates.length < 3}
                      className="w-full py-2 rounded-lg font-medium disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(135deg, #00A38D, #00A38DCC)",
                        color: "white",
                      }}
                    >
                      Finish Polygon ({tempCoordinates.length} points)
                    </button>
                  </div>
                )}

                {drawingMode === "line" && tempCoordinates.length > 0 && (
                  <div className="pt-2">
                    <button
                      onClick={finishDrawing}
                      disabled={tempCoordinates.length < 2}
                      className="w-full py-2 rounded-lg font-medium disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(135deg, #00A38D, #00A38DCC)",
                        color: "white",
                      }}
                    >
                      Finish Line ({tempCoordinates.length} points)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div
            className="flex-1 relative"
            ref={mapRef}
            onMouseMove={handleMouseMove}
            onClick={handleMapClick}
          >
            {/* Hidden canvas for export */}
            <canvas ref={canvasRef} className="hidden" />

            {foldersLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoadingSpinner message="Loading map data..." />
              </div>
            ) : activeLayer?.type === "google-open" && selectedGoogleMap ? (
              <iframe
                src={selectedGoogleMap.iframeSrc}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={selectedGoogleMap.name}
                data-testid="google-map-iframe"
              />
            ) : activeLayer?.type === "interactive" ? (
              <div className="w-full h-full relative">
                {/* Google Embed Map as base */}
                <iframe
                  src={DEFAULT_MAP_EMBED}
                  className="w-full h-full border-0"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Interactive Map"
                />

                {/* Temporary polygon points */}
                {drawingMode === "polygon" &&
                  tempCoordinates.map((point, index) => (
                    <div
                      key={index}
                      className="absolute w-3 h-3 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: selectedColor,
                        left: `${((point.lng - 123.5298) / 0.1 + 0.5) * 100}%`,
                        top: `${(0.5 - (point.lat - 13.0752) / 0.1) * 100}%`,
                        transform: "translate(-50%, -50%)",
                        zIndex: 20,
                      }}
                    />
                  ))}

                {/* Temporary line points */}
                {drawingMode === "line" &&
                  tempCoordinates.map((point, index) => (
                    <div
                      key={index}
                      className="absolute w-3 h-3 rounded-full border-2 border-white"
                      style={{
                        backgroundColor: selectedColor,
                        left: `${((point.lng - 123.5298) / 0.1 + 0.5) * 100}%`,
                        top: `${(0.5 - (point.lat - 13.0752) / 0.1) * 100}%`,
                        transform: "translate(-50%, -50%)",
                        zIndex: 20,
                      }}
                    />
                  ))}

                {/* Lines */}
                {mapFeatures
                  .filter((feature) => feature.type === "line")
                  .map((line) => (
                    <svg
                      key={line.id}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 15 }}
                    >
                      {line.coordinates.length >= 2 && (
                        <polyline
                          points={line.coordinates
                            .map(
                              (point) =>
                                `${((point.lng - 123.5298) / 0.1 + 0.5) * 100}%,${(0.5 - (point.lat - 13.0752) / 0.1) * 100}%`,
                            )
                            .join(" ")}
                          fill="none"
                          stroke={line.color}
                          strokeWidth={line.weight}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}
                    </svg>
                  ))}

                {/* Polygons */}
                {mapFeatures
                  .filter((feature) => feature.type === "polygon")
                  .map((polygon) => (
                    <svg
                      key={polygon.id}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 10 }}
                    >
                      {polygon.coordinates.length >= 3 && (
                        <polygon
                          points={polygon.coordinates
                            .map(
                              (point) =>
                                `${((point.lng - 123.5298) / 0.1 + 0.5) * 100}%,${(0.5 - (point.lat - 13.0752) / 0.1) * 100}%`,
                            )
                            .join(" ")}
                          fill={polygon.fillColor}
                          stroke={polygon.color}
                          strokeWidth="2"
                        />
                      )}
                    </svg>
                  ))}

                {/* Markers */}
                {mapFeatures
                  .filter((feature) => feature.type === "marker")
                  .map((marker) => (
                    <div
                      key={marker.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      style={{
                        left: `${((marker.coordinates[0].lng - 123.5298) / 0.1 + 0.5) * 100}%`,
                        top: `${(0.5 - (marker.coordinates[0].lat - 13.0752) / 0.1) * 100}%`,
                        zIndex: 25,
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center relative"
                        style={{ backgroundColor: marker.color }}
                      >
                        <MapPinned className="w-3 h-3 text-white" />
                      </div>
                      <div
                        className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{
                          background: "rgba(0, 0, 0, 0.8)",
                          color: "white",
                          minWidth: "120px",
                        }}
                      >
                        <div className="font-bold">{marker.title}</div>
                        {marker.description && (
                          <div className="mt-1">{marker.description}</div>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFeature(marker.id);
                        }}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2 h-2 text-white" />
                      </button>
                    </div>
                  ))}

                {/* Legend */}
                {showLegend && (
                  <div
                    className="absolute bottom-4 left-4 p-4 rounded-xl max-w-xs"
                    style={{
                      background: "rgba(14, 33, 72, 0.95)",
                      backdropFilter: "blur(15px)",
                      border: "1px solid rgba(121, 101, 193, 0.4)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4
                        className="font-bold text-sm"
                        style={{ color: "#E3D095" }}
                      >
                        Map Legend
                      </h4>
                      <button
                        onClick={() => setShowLegend(false)}
                        className="p-1 rounded"
                        style={{ color: "#E3D095" }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {mapFeatures.length > 0 ? (
                        <>
                          {mapFeatures.filter((f) => f.type === "marker")
                            .length > 0 && (
                            <div>
                              <div
                                className="text-xs font-medium mb-1"
                                style={{ color: "rgba(227, 208, 149, 0.8)" }}
                              >
                                Markers
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {mapFeatures
                                  .filter((f) => f.type === "marker")
                                  .map((feature) => (
                                    <div
                                      key={feature.id}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <div
                                        className="w-3 h-3 rounded-full border border-white"
                                        style={{
                                          backgroundColor: feature.color,
                                        }}
                                      />
                                      <span
                                        className="truncate"
                                        style={{
                                          color: "rgba(227, 208, 149, 0.7)",
                                        }}
                                      >
                                        {feature.title}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          {mapFeatures.filter((f) => f.type === "polygon")
                            .length > 0 && (
                            <div>
                              <div
                                className="text-xs font-medium mb-1"
                                style={{ color: "rgba(227, 208, 149, 0.8)" }}
                              >
                                Polygons
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {mapFeatures
                                  .filter((f) => f.type === "polygon")
                                  .map((feature) => (
                                    <div
                                      key={feature.id}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <div
                                        className="w-3 h-3 border border-white"
                                        style={{
                                          backgroundColor: feature.fillColor,
                                        }}
                                      />
                                      <span
                                        className="truncate"
                                        style={{
                                          color: "rgba(227, 208, 149, 0.7)",
                                        }}
                                      >
                                        {feature.title}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          {mapFeatures.filter((f) => f.type === "line").length >
                            0 && (
                            <div>
                              <div
                                className="text-xs font-medium mb-1"
                                style={{ color: "rgba(227, 208, 149, 0.8)" }}
                              >
                                Lines
                              </div>
                              <div className="space-y-1 max-h-32 overflow-y-auto">
                                {mapFeatures
                                  .filter((f) => f.type === "line")
                                  .map((feature) => (
                                    <div
                                      key={feature.id}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <div
                                        className="w-4 h-1"
                                        style={{
                                          backgroundColor: feature.color,
                                        }}
                                      />
                                      <span
                                        className="truncate"
                                        style={{
                                          color: "rgba(227, 208, 149, 0.7)",
                                        }}
                                      >
                                        {feature.title}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div
                          className="text-xs"
                          style={{ color: "rgba(227, 208, 149, 0.6)" }}
                        >
                          No features added yet
                        </div>
                      )}
                    </div>
                    {mapFeatures.length > 0 && (
                      <button
                        onClick={clearAllFeatures}
                        className="mt-3 w-full py-1 rounded text-xs flex items-center justify-center gap-1"
                        style={{
                          background: "rgba(220, 53, 69, 0.2)",
                          color: "#DC3545",
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear All
                      </button>
                    )}
                  </div>
                )}

                {!showLegend && (
                  <button
                    onClick={() => setShowLegend(true)}
                    className="absolute bottom-4 left-4 p-2 rounded-full"
                    style={{
                      background: "rgba(14, 33, 72, 0.95)",
                      backdropFilter: "blur(15px)",
                      border: "1px solid rgba(121, 101, 193, 0.4)",
                      color: "#E3D095",
                    }}
                    title="Show Legend"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : selectedFile ? (
              <div className="w-full h-full flex flex-col">
                <div
                  className="p-4 flex items-center justify-between gap-4"
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    borderBottom: "1px solid rgba(121, 101, 193, 0.3)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {(() => {
                      const FileIcon = getFileIcon(selectedFile.mimeType);
                      return (
                        <FileIcon
                          className="w-5 h-5 flex-shrink-0"
                          style={{ color: "#00A38D" }}
                        />
                      );
                    })()}
                    <span
                      className="font-medium truncate"
                      style={{ color: "#E3D095" }}
                    >
                      {selectedFile.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedFile.webViewLink && (
                      <a
                        href={selectedFile.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background:
                            "linear-gradient(135deg, #00A38D, #00A38DCC)",
                          color: "white",
                        }}
                        data-testid="link-open-file"
                      >
                        Open in Drive
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="p-2 rounded-lg hover-elevate"
                      style={{ color: "#E3D095" }}
                      data-testid="button-close-file"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center p-4">
                  {selectedFile.mimeType.includes("image") &&
                  selectedFile.thumbnailLink ? (
                    <img
                      src={selectedFile.thumbnailLink.replace(
                        "=s220",
                        "=s1000",
                      )}
                      alt={selectedFile.name}
                      className="max-w-full max-h-full object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                      onClick={() =>
                        openImageModal(
                          selectedFile.thumbnailLink!.replace(
                            "=s220",
                            "=s1000",
                          ),
                          selectedFile.name,
                        )
                      }
                    />
                  ) : selectedFile.webViewLink ? (
                    <iframe
                      src={selectedFile.webViewLink.replace(
                        "/view",
                        "/preview",
                      )}
                      className="w-full h-full rounded-lg"
                      style={{
                        border: "1px solid rgba(121, 101, 193, 0.3)",
                        minHeight: "500px",
                      }}
                      title={selectedFile.name}
                    />
                  ) : (
                    <div
                      className="text-center p-8 rounded-xl"
                      style={{ background: "rgba(255, 255, 255, 0.05)" }}
                    >
                      <FileText
                        className="w-16 h-16 mx-auto mb-4"
                        style={{ color: "#00A38D" }}
                      />
                      <p style={{ color: "#E3D095" }}>Preview not available</p>
                      <p
                        className="text-sm mt-2"
                        style={{ color: "rgba(227, 208, 149, 0.6)" }}
                      >
                        Click "Open in Drive" to view this file
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : layerFolders.length > 0 ? (
              <div
                className="w-full h-full overflow-auto p-6"
                style={{
                  background:
                    "linear-gradient(135deg, #1A1E32 0%, #0E2148 50%, #1A1E32 100%)",
                }}
              >
                <div className="max-w-6xl mx-auto">
                  <h2
                    className="text-xl font-bold mb-6"
                    style={{ color: "#E3D095" }}
                  >
                    {activeLayer?.name} Files
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredFolders.flatMap((folder) =>
                      (folder.files || []).map((file) => {
                        const FileIcon = getFileIcon(file.mimeType);
                        const isImage = file.mimeType.includes("image");
                        return (
                          <button
                            key={file.id}
                            onClick={() =>
                              isImage && file.thumbnailLink
                                ? openImageModal(
                                    file.thumbnailLink.replace(
                                      "=s220",
                                      "=s1000",
                                    ),
                                    file.name,
                                  )
                                : setSelectedFile(file)
                            }
                            className="p-4 rounded-xl text-left transition-all hover-elevate"
                            style={{
                              background: "rgba(14, 33, 72, 0.85)",
                              border: "1px solid rgba(121, 101, 193, 0.3)",
                            }}
                            data-testid={`file-card-${file.id}`}
                          >
                            {file.thumbnailLink && isImage ? (
                              <div
                                className="w-full h-32 rounded-lg mb-3 bg-cover bg-center"
                                style={{
                                  backgroundImage: `url(${file.thumbnailLink})`,
                                }}
                              />
                            ) : (
                              <div
                                className="w-full h-32 rounded-lg mb-3 flex items-center justify-center"
                                style={{ background: "rgba(0, 163, 141, 0.1)" }}
                              >
                                <FileIcon
                                  className="w-12 h-12"
                                  style={{ color: "#00A38D" }}
                                />
                              </div>
                            )}
                            <p
                              className="font-medium text-sm truncate"
                              style={{ color: "#E3D095" }}
                            >
                              {file.name}
                            </p>
                            <p
                              className="text-xs mt-1 truncate"
                              style={{ color: "rgba(227, 208, 149, 0.5)" }}
                            >
                              {folder.name}
                            </p>
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, #1A1E32 0%, #0E2148 50%, #1A1E32 100%)",
                }}
              >
                <div
                  className="rounded-2xl p-8 text-center max-w-lg mx-4"
                  style={{
                    background: "rgba(14, 33, 72, 0.9)",
                    border: "1px solid rgba(121, 101, 193, 0.4)",
                  }}
                >
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{
                      background: "linear-gradient(135deg, #00A38D, #00A38DCC)",
                    }}
                  >
                    <FolderOpen className="w-10 h-10 text-white" />
                  </div>
                  <h3
                    className="text-xl font-bold mb-3"
                    style={{ color: "#E3D095" }}
                  >
                    {activeLayer?.name}
                  </h3>
                  <p
                    className="text-sm"
                    style={{ color: "rgba(227, 208, 149, 0.7)" }}
                  >
                    {activeLayer?.type === "google-open"
                      ? "Select a map from the sidebar to view the interactive Google Map."
                      : "No files found in this map layer. Files from Google Drive will appear here when available."}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div
            className="flex items-center justify-between px-4 py-2 text-xs gap-4"
            style={{
              background: "rgba(14, 33, 72, 0.95)",
              borderTop: "1px solid rgba(121, 101, 193, 0.3)",
              color: "rgba(227, 208, 149, 0.7)",
            }}
          >
            <div className="flex items-center gap-4">
              <span data-testid="text-coordinates">
                Lat: {mouseCoords.lat.toFixed(4)}, Lng:{" "}
                {mouseCoords.lng.toFixed(4)}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">
                Layer: {activeLayer?.name || "None"}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <span>
                Source:{" "}
                {activeLayer?.type === "google-open"
                  ? "Google Maps"
                  : activeLayer?.type === "interactive"
                    ? "MDRRMO"
                    : "Google Drive"}
              </span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">MDRRMO Pio Duran</span>
            </div>
          </div>
        </div>
      </main>

      {imageModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.9)" }}
          onClick={closeImageModal}
        >
          <div
            className="relative max-w-7xl max-h-[90vh] w-full h-full flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between p-4 rounded-t-xl"
              style={{
                background: "rgba(14, 33, 72, 0.95)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(121, 101, 193, 0.4)",
                borderBottom: "none",
              }}
            >
              <h3
                className="font-bold text-lg truncate"
                style={{ color: "#E3D095" }}
              >
                {modalImageName}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyImage}
                  disabled={activeLayer?.type === "panorama"}
                  className="p-2 rounded-lg transition-all hover-elevate disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(0, 163, 141, 0.2)",
                    color: "#00A38D",
                  }}
                  title="Copy Image"
                  data-testid="button-copy-image"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDownloadImage}
                  className="p-2 rounded-lg transition-all hover-elevate"
                  style={{
                    background: "rgba(0, 163, 141, 0.2)",
                    color: "#00A38D",
                  }}
                  title="Download Image"
                  data-testid="button-download-image"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handlePrintImage}
                  disabled={activeLayer?.type === "panorama"}
                  className="p-2 rounded-lg transition-all hover-elevate disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(0, 163, 141, 0.2)",
                    color: "#00A38D",
                  }}
                  title="Print Image"
                  data-testid="button-print-modal-image"
                >
                  <Printer className="w-5 h-5" />
                </button>
                <button
                  onClick={closeImageModal}
                  className="p-2 rounded-lg transition-all hover-elevate"
                  style={{ color: "#E3D095" }}
                  title="Close"
                  data-testid="button-close-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div
              className="flex-1 flex items-center justify-center p-8 rounded-b-xl overflow-auto"
              style={{
                background: "rgba(14, 33, 72, 0.95)",
                backdropFilter: "blur(15px)",
                border: "1px solid rgba(121, 101, 193, 0.4)",
                borderTop: "none",
              }}
            >
              {activeLayer?.type === "panorama" ? (
                <div className="w-full h-full max-w-4xl max-h-[70vh]">
                  <Pannellum
                    width="100%"
                    height="100%"
                    image={modalImageUrl}
                    pitch={10}
                    yaw={180}
                    hfov={110}
                    autoLoad
                    compass
                    mouseZoom={false}
                  />
                </div>
              ) : (
                <img
                  ref={imageRef}
                  src={modalImageUrl}
                  alt={modalImageName}
                  className="max-w-full max-h-full object-contain"
                  style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
