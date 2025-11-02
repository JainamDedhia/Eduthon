import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function UploadMaterial() {
  const { classCode } = useLocalSearchParams(); // from teacher dashboard
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];

      setLoading(true);

      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || "application/octet-stream",
      });
      formData.append("folder", classCode);

      const res = await fetch("https://eduthon-backend.onrender.com/upload", {
  method: "POST",
  body: formData,
});


      const text = await res.text();
if (!res.ok) {
  console.error("❌ Upload error response:", text);
  throw new Error(text || "Upload failed");
}
const data = JSON.parse(text);


      const classRef = doc(db, "classes", classCode);
      await updateDoc(classRef, {
        materials: arrayUnion({
          name: file.name,
          url: data.url,
          uploadedAt: new Date().toISOString(),
        }),
      });

      Alert.alert("✅ Success", "File uploaded successfully!");
      router.back();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Material</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handlePickAndUpload}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>Select & Upload File</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#999", marginTop: 20 }]}
        onPress={() => router.back()}
      >
        <Text style={styles.buttonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
  },
  button: {
    backgroundColor: "#4A90E2",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
