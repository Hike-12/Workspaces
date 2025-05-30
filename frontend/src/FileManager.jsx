import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { API_ENDPOINTS } from "./lib/utils";
import { File, Upload, Trash2, Eye, FileText } from "lucide-react";
import { motion } from 'framer-motion';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useNavigate } from "react-router-dom";

const COLORS = {
  bg: "#F7FAFC",
  card: "#FFFFFF",
  border: "#E5E7EB",
  accent: "#03346E",
  accent2: "#6EACDA",
  text: "#021526",
  muted: "#6B7280",
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

  // Helper function to format date nicely
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Animation variants
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
      className="min-h-screen p-8"
      style={{
        background: COLORS.bg,
      }}
    >
      <ToastContainer position="top-right" theme="light" />
      <div className="mb-6">
        <button
          onClick={() => navigate(`/room/${roomId}`)}
          className="flex items-center px-4 py-2 rounded-lg font-medium bg-[#03346E] text-white hover:bg-[#021526] transition-all"
        >
          ← Back to Chat
        </button>
      </div>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto"
      >
        {/* Header */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <h1
            className="text-3xl font-bold"
            style={{
              color: COLORS.accent,
              letterSpacing: "-0.01em",
            }}
          >
            File Manager
          </h1>
          <p className="text-base mt-2" style={{ color: COLORS.muted }}>
            Upload, view, and manage room files
          </p>
        </motion.div>
        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-6 mb-8 border shadow-sm"
          style={{
            background: COLORS.card,
            borderColor: COLORS.border,
          }}
        >
          <h2 className="text-xl font-semibold mb-4 flex items-center" style={{ color: COLORS.accent }}>
            <Upload className="mr-2 h-5 w-5" style={{ color: COLORS.accent2 }} />
            Upload New File
          </h2>
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                readOnly
                className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: COLORS.text }}>
                Select File
              </label>
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full px-4 py-2 rounded-lg border bg-white text-[#021526] border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#03346E] transition-all"
                required
              />
            </div>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-2 rounded-lg font-semibold bg-[#03346E] text-white hover:bg-[#021526] transition-all"
            >
              Upload File
            </motion.button>
          </form>
          {uploadMessage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg text-[#03346E] font-semibold border"
              style={{
                background: "#F1F5F9",
                borderColor: COLORS.accent2,
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
          className="rounded-xl p-6 border shadow-sm"
          style={{
            background: COLORS.card,
            borderColor: COLORS.border,
          }}
        >
          <h2 className="text-xl font-semibold mb-6 flex items-center" style={{ color: COLORS.accent }}>
            <FileText className="mr-2 h-5 w-5" style={{ color: COLORS.accent2 }} />
            Room Files
          </h2>
          {files.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-base text-center py-8"
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
                  className="rounded-lg p-4 border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm bg-white"
                  style={{
                    borderColor: COLORS.border,
                  }}
                >
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: COLORS.accent }}>
                      {file.name}
                    </h3>
                    <p className="text-sm" style={{ color: COLORS.muted }}>
                      Uploaded by: {file.uploaded_by || 'User'} • {formatDate(file.uploaded_at || new Date())}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleViewFile(file.id)}
                      className="px-4 py-2 rounded-lg font-medium bg-[#03346E] text-white hover:bg-[#021526] transition-all flex items-center"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteFile(file.id)}
                      className="px-4 py-2 rounded-lg font-medium bg-red-500 text-white hover:bg-red-700 transition-all flex items-center"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
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