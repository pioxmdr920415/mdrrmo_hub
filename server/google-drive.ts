// Google Drive Integration for MDRRMO Pio Duran
// Using the google-drive connector blueprint with shared token manager

import { google } from "googleapis";
import type { DriveFolder, DriveFile, GalleryImage } from "@shared/schema";
import { getGoogleDriveToken } from "./google-token-manager";
import { Readable } from "stream";

const DOCUMENTS_ROOT_FOLDER_ID = "15_xiFeXu_vdIe2CYrjGaRCAho2OqhGvo";
const GALLERY_ROOT_FOLDER_ID = "1O1WlCjMvZ5lVcrOIGNMlBY4ZuQ-zEarg";

const MAP_FOLDER_IDS = {
  administrative: "1Wh2wSQuyzHiz25Vbr4ICETj18RRUEpvi",
  topographic: "1Y01dJR_YJdixvsi_B9Xs7nQaXD31_Yn2",
  "land-use": "1yQmtrKfKiMOFA933W0emzeGoexMpUDGM",
  hazards: "16xy_oUAr6sWb3JE9eNrxYJdAMDRKGYLn",
  other: "1MI1aO_-gQwsRbSJsfHY2FI4AOz9Jney1",
  panorama: "1tsbcsTEfg5RLHLJLYXR41avy9SrajsqM",
};

async function getGoogleDriveClient() {
  const accessToken = await getGoogleDriveToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function getDocumentFolders(): Promise<DriveFolder[]> {
  try {
    const drive = await getGoogleDriveClient();

    // Fetch only folders from the specific root folder
    const response = await drive.files.list({
      q: `'${DOCUMENTS_ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 100,
      orderBy: "name",
    });

    const folders = response.data.files || [];

    if (folders.length === 0) {
      console.warn("No folders found in the specified Google Drive folder");
      return [];
    }

    // Fetch all files from the root folder (not from subfolders)
    const filesResponse = await drive.files.list({
      q: `'${DOCUMENTS_ROOT_FOLDER_ID}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields:
        "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime, size)",
      pageSize: 500,
      orderBy: "name",
    });

    const allFiles = filesResponse.data.files || [];

    // Create folder structure
    const result: DriveFolder[] = folders.map((folder) => ({
      id: folder.id!,
      name: folder.name!,
      files: [],
    }));

    // Add a special "All Files" entry at the beginning containing all files
    if (allFiles.length > 0) {
      result.unshift({
        id: DOCUMENTS_ROOT_FOLDER_ID,
        name: "All Documents",
        files: allFiles.map((file) => ({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          webViewLink: file.webViewLink || undefined,
          webContentLink: file.webContentLink || undefined,
          thumbnailLink: file.thumbnailLink || undefined,
          createdTime: file.createdTime || undefined,
          modifiedTime: file.modifiedTime || undefined,
          size: file.size || undefined,
        })),
      });
    }

    return result;
  } catch (error) {
    console.error("Error fetching document folders from Google Drive:", error);
    throw error;
  }
}

export async function getMapFolderContents(
  mapType: keyof typeof MAP_FOLDER_IDS,
): Promise<DriveFolder[]> {
  const folderId = MAP_FOLDER_IDS[mapType];
  if (!folderId) {
    throw new Error(`Unknown map type: ${mapType}`);
  }

  try {
    const drive = await getGoogleDriveClient();

    const foldersResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 100,
      orderBy: "name",
    });

    const folders = foldersResponse.data.files || [];

    const filesInRootResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
      fields:
        "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink)",
      pageSize: 100,
      orderBy: "name",
    });

    const rootFiles = filesInRootResponse.data.files || [];

    const result: DriveFolder[] = [];

    if (rootFiles.length > 0) {
      result.push({
        id: folderId,
        name: "Root Files",
        files: rootFiles.map((file) => ({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          webViewLink: file.webViewLink || undefined,
          webContentLink: file.webContentLink || undefined,
          thumbnailLink: file.thumbnailLink || undefined,
        })),
      });
    }

    const folderContents = await Promise.all(
      folders.map(async (folder) => {
        const filesResponse = await drive.files.list({
          q: `'${folder.id}' in parents and trashed=false`,
          fields:
            "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink)",
          pageSize: 100,
        });

        const subFoldersResponse = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id, name)",
          pageSize: 50,
        });

        return {
          id: folder.id!,
          name: folder.name!,
          files: (filesResponse.data.files || [])
            .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
            .map((file) => ({
              id: file.id!,
              name: file.name!,
              mimeType: file.mimeType!,
              webViewLink: file.webViewLink || undefined,
              webContentLink: file.webContentLink || undefined,
              thumbnailLink: file.thumbnailLink || undefined,
            })),
          subfolders: (subFoldersResponse.data.files || []).map((sf) => ({
            id: sf.id!,
            name: sf.name!,
          })),
        };
      }),
    );

    result.push(...folderContents);

    return result;
  } catch (error) {
    console.error(`Error fetching ${mapType} maps from Google Drive:`, error);
    throw error;
  }
}

export async function getSubfolderContents(
  folderId: string,
): Promise<DriveFolder> {
  try {
    const drive = await getGoogleDriveClient();

    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: "id, name",
    });

    const filesResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields:
        "files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink)",
      pageSize: 100,
      orderBy: "name",
    });

    const subFoldersResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 50,
    });

    return {
      id: folderInfo.data.id!,
      name: folderInfo.data.name!,
      files: (filesResponse.data.files || [])
        .filter((f) => f.mimeType !== "application/vnd.google-apps.folder")
        .map((file) => ({
          id: file.id!,
          name: file.name!,
          mimeType: file.mimeType!,
          webViewLink: file.webViewLink || undefined,
          webContentLink: file.webContentLink || undefined,
          thumbnailLink: file.thumbnailLink || undefined,
        })),
      subfolders: (subFoldersResponse.data.files || []).map((sf) => ({
        id: sf.id!,
        name: sf.name!,
      })),
    };
  } catch (error) {
    console.error("Error fetching subfolder contents:", error);
    throw error;
  }
}

export async function getAdministrativeMaps(): Promise<DriveFolder[]> {
  return getMapFolderContents("administrative");
}

export async function getGalleryFolders(): Promise<DriveFolder[]> {
  try {
    const drive = await getGoogleDriveClient();
    const GALLERY_ROOT_FOLDER_ID = "1O1WlCjMvZ5lVcrOIGNMlBY4ZuQ-zEarg";

    // Fetch sub-folders (first level)
    const response = await drive.files.list({
      q: `'${GALLERY_ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 100,
      orderBy: "name",
    });

    const folders = response.data.files || [];

    if (folders.length === 0) {
      console.warn("No sub-folders found in gallery root folder");
      return [];
    }

    // For each sub-folder, fetch its sub-sub-folders
    const result: DriveFolder[] = await Promise.all(
      folders.map(async (folder) => {
        const subFoldersResponse = await drive.files.list({
          q: `'${folder.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id, name)",
          pageSize: 100,
          orderBy: "name",
        });

        const subFolders = (subFoldersResponse.data.files || []).map(
          (subFolder) => ({
            id: subFolder.id!,
            name: subFolder.name!,
          }),
        );

        return {
          id: folder.id!,
          name: folder.name!,
          subfolders: subFolders,
        };
      }),
    );

    return result;
  } catch (error) {
    console.error("Error fetching gallery folders from Google Drive:", error);
    throw error;
  }
}

export async function getGalleryImages(
  folderId: string,
): Promise<GalleryImage[]> {
  if (!folderId) {
    throw new Error("Folder ID is required");
  }

  try {
    const drive = await getGoogleDriveClient();

    const response = await drive.files.list({
      q: `'${folderId}' in parents and (mimeType contains 'image/') and trashed=false`,
      fields:
        "files(id, name, thumbnailLink, webViewLink, webContentLink, description, createdTime)",
      pageSize: 100,
    });

    const files = response.data.files || [];

    return files.map((file) => ({
      id: file.id!,
      name: file.name!,
      thumbnailLink: file.thumbnailLink || undefined,
      webViewLink: file.webViewLink || undefined,
      webContentLink: file.webContentLink || undefined,
      description: file.description || undefined,
      createdTime: file.createdTime || undefined,
      folder: folderId,
    }));
  } catch (error) {
    console.error("Error fetching gallery images from Google Drive:", error);
    throw error;
  }
}

export async function deleteGalleryImages(imageIds: string[]): Promise<void> {
  if (!imageIds || imageIds.length === 0) {
    throw new Error("Image IDs are required");
  }

  try {
    const drive = await getGoogleDriveClient();

    await Promise.all(
      imageIds.map(async (fileId) => {
        await drive.files.update({
          fileId,
          requestBody: {
            trashed: true,
          },
        });
      }),
    );
  } catch (error) {
    console.error("Error deleting gallery images from Google Drive:", error);
    throw error;
  }
}

export async function renameGalleryImage(
  imageId: string,
  newName: string,
): Promise<void> {
  if (!imageId || !newName) {
    throw new Error("Image ID and new name are required");
  }

  try {
    const drive = await getGoogleDriveClient();

    await drive.files.update({
      fileId: imageId,
      requestBody: {
        name: newName,
      },
    });
  } catch (error) {
    console.error("Error renaming gallery image:", error);
    throw error;
  }
}

// File upload functions for Documents
export async function uploadDocumentFile(
  fileName: string,
  mimeType: string,
  fileBuffer: Buffer,
  folderId?: string
): Promise<DriveFile> {
  try {
    const drive = await getGoogleDriveClient();
    const targetFolderId = folderId || DOCUMENTS_ROOT_FOLDER_ID;

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [targetFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(fileBuffer),
      },
      fields: "id, name, mimeType, webViewLink, webContentLink, thumbnailLink, createdTime, modifiedTime, size",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      mimeType: response.data.mimeType!,
      webViewLink: response.data.webViewLink || undefined,
      webContentLink: response.data.webContentLink || undefined,
      thumbnailLink: response.data.thumbnailLink || undefined,
      createdTime: response.data.createdTime || undefined,
      modifiedTime: response.data.modifiedTime || undefined,
      size: response.data.size || undefined,
    };
  } catch (error) {
    console.error("Error uploading document file:", error);
    throw error;
  }
}

// Create folder in documents
export async function createDocumentFolder(
  folderName: string,
  parentFolderId?: string
): Promise<{ id: string; name: string }> {
  try {
    const drive = await getGoogleDriveClient();
    const targetParentId = parentFolderId || DOCUMENTS_ROOT_FOLDER_ID;

    const response = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [targetParentId],
      },
      fields: "id, name",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
    };
  } catch (error) {
    console.error("Error creating document folder:", error);
    throw error;
  }
}

// Rename file or folder
export async function renameDocumentFile(
  fileId: string,
  newName: string
): Promise<void> {
  try {
    const drive = await getGoogleDriveClient();

    await drive.files.update({
      fileId,
      requestBody: {
        name: newName,
      },
    });
  } catch (error) {
    console.error("Error renaming document file:", error);
    throw error;
  }
}

// Delete file or folder
export async function deleteDocumentFile(fileId: string): Promise<void> {
  try {
    const drive = await getGoogleDriveClient();

    await drive.files.update({
      fileId,
      requestBody: {
        trashed: true,
      },
    });
  } catch (error) {
    console.error("Error deleting document file:", error);
    throw error;
  }
}

// Upload gallery images (supports bulk upload)
export async function uploadGalleryImages(
  files: Array<{ fileName: string; mimeType: string; buffer: Buffer }>,
  folderId: string
): Promise<GalleryImage[]> {
  if (!folderId) {
    throw new Error("Folder ID is required for gallery upload");
  }

  try {
    const drive = await getGoogleDriveClient();

    const uploadedImages = await Promise.all(
      files.map(async (file) => {
        const response = await drive.files.create({
          requestBody: {
            name: file.fileName,
            parents: [folderId],
          },
          media: {
            mimeType: file.mimeType,
            body: Readable.from(file.buffer),
          },
          fields: "id, name, thumbnailLink, webViewLink, webContentLink, createdTime",
        });

        return {
          id: response.data.id!,
          name: response.data.name!,
          thumbnailLink: response.data.thumbnailLink || undefined,
          webViewLink: response.data.webViewLink || undefined,
          webContentLink: response.data.webContentLink || undefined,
          createdTime: response.data.createdTime || undefined,
          folder: folderId,
        };
      })
    );

    return uploadedImages;
  } catch (error) {
    console.error("Error uploading gallery images:", error);
    throw error;
  }
}

// Get image for preview/download
export async function getImageContent(fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  try {
    const drive = await getGoogleDriveClient();

    // Get file metadata first
    const metadata = await drive.files.get({
      fileId,
      fields: "name, mimeType",
    });

    // Download file content
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return {
      buffer: Buffer.from(response.data as ArrayBuffer),
      mimeType: metadata.data.mimeType || "application/octet-stream",
      name: metadata.data.name || "download",
    };
  } catch (error) {
    console.error("Error getting image content:", error);
    throw error;
  }
}
