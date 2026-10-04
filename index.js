import "react-native-get-random-values";
import { Buffer } from "buffer";

// @solana/web3.js expects a global Buffer, which React Native doesn't provide.
global.Buffer = global.Buffer || Buffer;

// Defines the background task at module scope — required so Android can
// invoke it even when the app wasn't already open.
import "./src/services/backgroundTask";

// Expo Router's own entry boots the app after polyfills are in place.
import "expo-router/entry";
