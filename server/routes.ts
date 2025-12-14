import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { 
  getInventoryItems, 
  addInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem,
  getCalendarEvents, 
  addCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getCalendarTasks,
  addCalendarTask,
  updateCalendarTask,
  deleteCalendarTask, 
  getContacts,
  addContact,
  updateContact,
  deleteContact,
  getMapFrames,
  addMapFrame,
  updateMapFrame,
  deleteMapFrame
} from "./google-sheets";
import { 
  getDocumentFolders, 
  getGalleryFolders, 
  getGalleryImages, 
  deleteGalleryImages, 
  renameGalleryImage, 
  getAdministrativeMaps, 
  getMapFolderContents, 
  getSubfolderContents,
  uploadDocumentFile,
  createDocumentFolder,
  renameDocumentFile,
  deleteDocumentFile,
  uploadGalleryImages,
  getImageContent
} from "./google-drive";
import { getHazardZones, getMapAssets } from "./maps-data";
import { insertInventorySchema, insertEventSchema, insertTaskSchema, insertContactSchema, insertMapFrameSchema } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Inventory API endpoints
  app.get("/api/inventory", async (req, res) => {
    try {
      const items = await getInventoryItems();
      res.json(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory data" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const parsed = insertInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const item = await addInventoryItem(parsed.data);
      res.status(201).json(item);
    } catch (error) {
      console.error("Error adding inventory item:", error);
      res.status(500).json({ error: "Failed to add inventory item" });
    }
  });

  app.put("/api/inventory/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const parsed = insertInventorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await updateInventoryItem(index, parsed.data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  app.delete("/api/inventory/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      await deleteInventoryItem(index);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  // Calendar Events API endpoints
  app.get("/api/calendar/events", async (req, res) => {
    try {
      const events = await getCalendarEvents();
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  app.post("/api/calendar/events", async (req, res) => {
    try {
      const parsed = insertEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const event = await addCalendarEvent(parsed.data);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error adding calendar event:", error);
      res.status(500).json({ error: "Failed to add calendar event" });
    }
  });

  app.put("/api/calendar/events/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const parsed = insertEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await updateCalendarEvent(index, parsed.data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ error: "Failed to update calendar event" });
    }
  });

  app.delete("/api/calendar/events/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      await deleteCalendarEvent(index);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ error: "Failed to delete calendar event" });
    }
  });

  // Calendar Tasks API endpoints
  app.get("/api/calendar/tasks", async (req, res) => {
    try {
      const tasks = await getCalendarTasks();
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching calendar tasks:", error);
      res.status(500).json({ error: "Failed to fetch calendar tasks" });
    }
  });

  app.post("/api/calendar/tasks", async (req, res) => {
    try {
      const parsed = insertTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const task = await addCalendarTask(parsed.data);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error adding calendar task:", error);
      res.status(500).json({ error: "Failed to add calendar task" });
    }
  });

  app.put("/api/calendar/tasks/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const parsed = insertTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await updateCalendarTask(index, parsed.data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating calendar task:", error);
      res.status(500).json({ error: "Failed to update calendar task" });
    }
  });

  app.delete("/api/calendar/tasks/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      await deleteCalendarTask(index);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar task:", error);
      res.status(500).json({ error: "Failed to delete calendar task" });
    }
  });

  // Contacts API endpoints
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const contact = await addContact(parsed.data);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error adding contact:", error);
      res.status(500).json({ error: "Failed to add contact" });
    }
  });

  app.put("/api/contacts/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await updateContact(index, parsed.data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      await deleteContact(index);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // Map Frames API endpoints
  app.get("/api/maps/frames", async (req, res) => {
    try {
      const frames = await getMapFrames();
      res.json(frames);
    } catch (error) {
      console.error("Error fetching map frames:", error);
      res.status(500).json({ error: "Failed to fetch map frames" });
    }
  });

  app.post("/api/maps/frames", async (req, res) => {
    try {
      const parsed = insertMapFrameSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const frame = await addMapFrame(parsed.data);
      res.status(201).json(frame);
    } catch (error) {
      console.error("Error adding map frame:", error);
      res.status(500).json({ error: "Failed to add map frame" });
    }
  });

  app.put("/api/maps/frames/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      const parsed = insertMapFrameSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      await updateMapFrame(index, parsed.data);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating map frame:", error);
      res.status(500).json({ error: "Failed to update map frame" });
    }
  });

  app.delete("/api/maps/frames/:index", async (req, res) => {
    try {
      const index = parseInt(req.params.index);
      await deleteMapFrame(index);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting map frame:", error);
      res.status(500).json({ error: "Failed to delete map frame" });
    }
  });

  // Documents API endpoints
  app.get("/api/documents", async (req, res) => {
    try {
      const folders = await getDocumentFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Document file upload
  app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }
      const folderId = req.body.folderId as string | undefined;
      const file = await uploadDocumentFile(
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer,
        folderId
      );
      res.status(201).json(file);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ error: "Failed to upload document" });
    }
  });

  // Create document folder
  app.post("/api/documents/folders", async (req, res) => {
    try {
      const { name, parentFolderId } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Folder name is required" });
      }
      const folder = await createDocumentFolder(name, parentFolderId);
      res.status(201).json(folder);
    } catch (error) {
      console.error("Error creating folder:", error);
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  // Rename document file/folder
  app.patch("/api/documents/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      await renameDocumentFile(fileId, name);
      res.json({ success: true });
    } catch (error) {
      console.error("Error renaming document:", error);
      res.status(500).json({ error: "Failed to rename document" });
    }
  });

  // Delete document file/folder
  app.delete("/api/documents/:fileId", async (req, res) => {
    try {
      const { fileId } = req.params;
      await deleteDocumentFile(fileId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  // Get document folder contents (files and subfolders)
  app.get("/api/documents/folder/:folderId", async (req, res) => {
    try {
      const { folderId } = req.params;
      const folder = await getSubfolderContents(folderId);
      res.json(folder);
    } catch (error) {
      console.error("Error fetching document folder:", error);
      res.status(500).json({ error: "Failed to fetch document folder" });
    }
  });

  // Gallery API endpoints
  app.get("/api/gallery/folders", async (req, res) => {
    try {
      const folders = await getGalleryFolders();
      res.json(folders);
    } catch (error) {
      console.error("Error fetching gallery folders:", error);
      res.status(500).json({ error: "Failed to fetch gallery folders" });
    }
  });

  app.get("/api/gallery/images", async (req, res) => {
    try {
      const folderId = req.query.folderId as string;
      if (!folderId) {
        return res.status(400).json({ error: "Folder ID is required" });
      }
      const images = await getGalleryImages(folderId);
      res.json(images);
    } catch (error) {
      console.error("Error fetching gallery images:", error);
      res.status(500).json({ error: "Failed to fetch gallery images" });
    }
  });

  app.delete("/api/gallery/images", async (req, res) => {
    try {
      const { imageIds } = req.body;
      if (!imageIds || !Array.isArray(imageIds) || imageIds.length === 0) {
        return res.status(400).json({ error: "Image IDs are required" });
      }
      await deleteGalleryImages(imageIds);
      res.json({ success: true, deleted: imageIds.length });
    } catch (error) {
      console.error("Error deleting gallery images:", error);
      res.status(500).json({ error: "Failed to delete gallery images" });
    }
  });

  app.patch("/api/gallery/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const { name } = req.body;
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }
      await renameGalleryImage(imageId, name);
      res.json({ success: true });
    } catch (error) {
      console.error("Error renaming gallery image:", error);
      res.status(500).json({ error: "Failed to rename gallery image" });
    }
  });

  // Gallery bulk image upload (supports drag-and-drop)
  app.post("/api/gallery/upload", upload.array("images", 20), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const folderId = req.body.folderId as string;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }
      if (!folderId) {
        return res.status(400).json({ error: "Folder ID is required" });
      }

      const fileData = files.map(f => ({
        fileName: f.originalname,
        mimeType: f.mimetype,
        buffer: f.buffer,
      }));

      const images = await uploadGalleryImages(fileData, folderId);
      res.status(201).json({ success: true, uploaded: images.length, images });
    } catch (error) {
      console.error("Error uploading gallery images:", error);
      res.status(500).json({ error: "Failed to upload images" });
    }
  });

  // Get image content for preview/download
  app.get("/api/gallery/images/:imageId/content", async (req, res) => {
    try {
      const { imageId } = req.params;
      const download = req.query.download === "true";
      
      const { buffer, mimeType, name } = await getImageContent(imageId);
      
      res.set("Content-Type", mimeType);
      if (download) {
        res.set("Content-Disposition", `attachment; filename="${name}"`);
      }
      res.send(buffer);
    } catch (error) {
      console.error("Error getting image content:", error);
      res.status(500).json({ error: "Failed to get image content" });
    }
  });

  // Get gallery subfolder contents
  app.get("/api/gallery/subfolder/:folderId", async (req, res) => {
    try {
      const { folderId } = req.params;
      const folder = await getSubfolderContents(folderId);
      res.json(folder);
    } catch (error) {
      console.error("Error fetching gallery subfolder:", error);
      res.status(500).json({ error: "Failed to fetch gallery subfolder" });
    }
  });

  // Maps API endpoints
  app.get("/api/maps/hazards", async (req, res) => {
    try {
      const zones = getHazardZones();
      res.json(zones);
    } catch (error) {
      console.error("Error fetching hazard zones:", error);
      res.status(500).json({ error: "Failed to fetch hazard zones" });
    }
  });

  app.get("/api/maps/assets", async (req, res) => {
    try {
      const assets = getMapAssets();
      res.json(assets);
    } catch (error) {
      console.error("Error fetching map assets:", error);
      res.status(500).json({ error: "Failed to fetch map assets" });
    }
  });

  app.get("/api/maps/administrative", async (req, res) => {
    try {
      const maps = await getAdministrativeMaps();
      res.json(maps);
    } catch (error) {
      console.error("Error fetching administrative maps:", error);
      res.status(500).json({ error: "Failed to fetch administrative maps" });
    }
  });

  app.get("/api/maps/topographic", async (req, res) => {
    try {
      const maps = await getMapFolderContents('topographic');
      res.json(maps);
    } catch (error) {
      console.error("Error fetching topographic maps:", error);
      res.status(500).json({ error: "Failed to fetch topographic maps" });
    }
  });

  app.get("/api/maps/land-use", async (req, res) => {
    try {
      const maps = await getMapFolderContents('land-use');
      res.json(maps);
    } catch (error) {
      console.error("Error fetching land use maps:", error);
      res.status(500).json({ error: "Failed to fetch land use maps" });
    }
  });

  app.get("/api/maps/hazards-files", async (req, res) => {
    try {
      const maps = await getMapFolderContents('hazards');
      res.json(maps);
    } catch (error) {
      console.error("Error fetching hazard maps:", error);
      res.status(500).json({ error: "Failed to fetch hazard maps" });
    }
  });

  app.get("/api/maps/other", async (req, res) => {
    try {
      const maps = await getMapFolderContents('other');
      res.json(maps);
    } catch (error) {
      console.error("Error fetching other maps:", error);
      res.status(500).json({ error: "Failed to fetch other maps" });
    }
  });

  app.get("/api/maps/panorama", async (req, res) => {
    try {
      const maps = await getMapFolderContents('panorama');
      res.json(maps);
    } catch (error) {
      console.error("Error fetching panorama maps:", error);
      res.status(500).json({ error: "Failed to fetch panorama maps" });
    }
  });

  app.get("/api/maps/subfolder/:folderId", async (req, res) => {
    try {
      const { folderId } = req.params;
      const folder = await getSubfolderContents(folderId);
      res.json(folder);
    } catch (error) {
      console.error("Error fetching subfolder contents:", error);
      res.status(500).json({ error: "Failed to fetch subfolder contents" });
    }
  });

  return httpServer;
}
