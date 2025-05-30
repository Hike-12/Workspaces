import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { File, Upload, Trash2, Eye, FileText, ArrowLeft } from "lucide-react";
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from "react-router-dom";

const COLORS = {
  bg: "#0C1844",         // main background (navy)
  card: "#FFF5E1",       // card/panel (cream)
  border: "#0C1844",     // border (navy)
  accent: "#0C1844",     // primary accent (navy)
  accent2: "#FFF5E1",    // secondary accent (cream)
  text: "#0C1844",       // main text (navy on cream)
  textLight: "#FFF5E1",  // light text (cream on navy)
  muted: "#0C1844",      // muted text (navy)
};

const FileManager = () => {
  const { roomId } = useParams();
  const userName = localStorage.getItem("userName");
  const userId = localStorage.getItem("userId");
  const [files, setFiles] = useState([]);
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const navigate = useNavigate();

  const handleViewFile = async (fileId) => {
    try {
      const response = await fetch(API_ENDPOINTS.VIEW_FILE(fileId), {
        method: "GET",
      });
  
      if (!response.ok) throw new Error("Failed to fetch file for viewing");
      
      const contentType = response.headers.get("content-type");
      const blob = await response.blob();
      const fileURL = URL.createObjectURL(blob);
      
      window.open(fileURL, "_blank");
      toast.success("File opened in new tab");
    } catch (err) {
      console.error("Error viewing file:", err.message);
      toast.error("Error viewing file. Please try again.");
    }
  };
  
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.GET_FILES(roomId), {
          method: "GET",
        });

        if (!response.ok) throw new Error("Failed to fetch files");

        const data = await response.json();
        setFiles(data.files || []);
      } catch (err) {
        console.error(err.message);
        toast.error("Failed to fetch files. Please try again later.");
      }
    };

    fetchFiles();
  }, [roomId]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setFileName(selectedFile ? selectedFile.name : "");
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!file || !fileName) {
      setUploadMessage("File and name are required");
      toast.error("File and name are required");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", fileName);
    formData.append("userName", userName);
    formData.append("userId", userId);

    try {
      const response = await fetch(API_ENDPOINTS.UPLOAD_FILE(roomId), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to upload file");

      const data = await response.json();
      setUploadMessage(data.message);
      
      // Refresh files list
      const filesResponse = await fetch(API_ENDPOINTS.GET_FILES(roomId));
      const filesData = await filesResponse.json();
      setFiles(filesData.files || []);
      
      setFile(null);
      setFileName("");
      toast.success("File uploaded successfully!");
    } catch (err) {
      console.error(err.message);
      setUploadMessage("Error uploading file");
      toast.error("Error uploading file. Please try again.");
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      const response = await fetch(API_ENDPOINTS.DELETE_FILE(fileId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete file");

      setFiles((prev) => prev.filter((file) => file.id !== fileId));
      toast.success("File deleted successfully");
    } catch (err) {
      console.error(err.message);
      toast.error("Failed to delete file. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.3 }
    }
  };

  return (
    <div
      className="min-h-screen p-4 sm:p-8"
      style={{
        background: COLORS.bg,
      }}
    >
      <ToastContainer position="top-right" theme="dark" />
      <div className="mb-8">
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="flex items-center px-6 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition-all duration-200"
          style={{
            background: COLORS.card,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Chat
        </button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto max-w-4xl"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10 text-center"
        >
          <h1
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{
              color: COLORS.textLight,
              letterSpacing: "-0.02em",
            }}
          >
            File Manager
          </h1>
          <p className="text-lg" style={{ color: COLORS.accent2 }}>
            Upload, view, and manage room files
          </p>
        </motion.div>
        
        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-6 sm:p-8 mb-10 shadow-xl"
          style={{
            background: COLORS.card,
            border: `1px solid rgba(12, 24, 68, 0.1)`,
          }}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center" style={{ color: COLORS.accent }}>
            <Upload className="mr-3 h-6 w-6" style={{ color: COLORS.accent }} />
            Upload New File
          </h2>
          <form onSubmit={handleFileUpload} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                readOnly
                className="w-full px-4 py-3 rounded-lg border"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: COLORS.text }}>
                Select File
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-4 py-3 rounded-lg border"
                style={{
                  background: "rgba(12, 24, 68, 0.02)",
                  color: COLORS.text,
                  border: `1px solid rgba(12, 24, 68, 0.2)`,
                }}
                required
              />
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-8 py-3 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200"
              style={{
                background: COLORS.accent,
                color: COLORS.textLight,
              }}
            >
              Upload File
            </motion.button>
          </form>
          {uploadMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-4 rounded-lg font-semibold"
              style={{
                background: COLORS.bg,
                color: COLORS.textLight,
              }}
            >
              {uploadMessage}
            </motion.div>
          )}
        </motion.div>
        
        {/* Files List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 sm:p-8 shadow-xl"
          style={{
            background: COLORS.card,
            border: `1px solid rgba(12, 24, 68, 0.1)`,
          }}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center" style={{ color: COLORS.accent }}>
            <FileText className="mr-3 h-6 w-6" style={{ color: COLORS.accent }} />
            Room Files
          </h2>
          {files.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-center py-12"
              style={{ color: COLORS.muted }}
            >
              No files uploaded yet
            </motion.p>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  variants={itemVariants}
                  className="rounded-xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-md transition-transform hover:scale-[1.01]"
                  style={{
                    background: COLORS.bg,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1" style={{ color: COLORS.textLight }}>
                      {file.name}
                    </h3>
                    <p className="text-sm" style={{ color: COLORS.accent2 }}>
                      Uploaded by: {file.uploaded_by || 'User'} • {formatDate(file.uploaded_at || new Date())}
                    </p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewFile(file.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
                      style={{
                        background: COLORS.accent,
                        color: COLORS.textLight,
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteFile(file.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-lg font-semibold flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200"
                      style={{
                        background: "#E74C3C",
                        color: COLORS.textLight,
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default FileManager;