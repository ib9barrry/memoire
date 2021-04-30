import React from "react";
import {
  Dimensions,
  Image,
  Slider,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
  ImageBackground,
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Font from "expo-font";
import * as Permissions from "expo-permissions";
import * as Icons from "./components/Icons";

import Constants from 'expo-constants';
import * as Speech from 'expo-speech';

import logo from './assets/images/logo0.png';
import logo1 from "./logo1.png"
import bg from './back.jpg'; 

const { width: DEVICE_WIDTH, height: DEVICE_HEIGHT } = Dimensions.get("window");
const BACKGROUND_COLOR = "#FFF8ED";
const LIVE_COLOR = "#FF0000";
const DISABLED_OPACITY = 0.9;
const RATE_SCALE = 3.0;

type Props = {};

type State = {
  haveRecordingPermissions: boolean;
  isLoading: boolean;
  isPlaybackAllowed: boolean;
  muted: boolean;
  soundPosition: number | null;
  soundDuration: number | null;
  recordingDuration: number | null;
  shouldPlay: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  fontLoaded: boolean;
  shouldCorrectPitch: boolean;
  volume: number;
  rate: number;
  trans: string;
  lien : string
};

export default class App extends React.Component<Props, State> {
  private recording: Audio.Recording | null;
  private sound: Audio.Sound | null;
  private isSeeking: boolean;
  private shouldPlayAtEndOfSeek: boolean;
  private readonly recordingSettings: Audio.RecordingOptions;

  constructor(props: Props) {
    super(props);
    this.recording = null;
    this.sound = null;
    this.isSeeking = false;
    this.shouldPlayAtEndOfSeek = false;
    
    this.state = {
      haveRecordingPermissions: false,
      isLoading: false,
      isPlaybackAllowed: false,
      muted: false,
      soundPosition: null,
      soundDuration: null,
      recordingDuration: null,
      shouldPlay: false,
      isPlaying: false,
      isRecording: false,
      fontLoaded: false,
      shouldCorrectPitch: true,
      volume: 1.0,
      rate: 1.0,
      trans: "Wolof : \nFrancais : ",
      lien: "",
    };
    this.recordingSettings = Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY;

    // UNCOMMENT THIS TO TEST maxFileSize:
    this.recordingSettings = {
      ...this.recordingSettings,
      android: {
        ...this.recordingSettings.android,
        maxFileSize: 12000,
        //extension: '.m4a',
        extension: '.wav',
        sampleRate: 22050,
        numberOfChannels: 2
      },
      ios: {
        //extension: '.caf',
        extension: '.wav',
        sampleRate: 22050,
        numberOfChannels: 2
      },
    };
  }

  componentDidMount() {
    (async () => {
      await Font.loadAsync({
        "cutive-mono-regular": require("./assets/fonts/CutiveMono-Regular.ttf"),
      });
      this.setState({ fontLoaded: true });
    })();
    this._askForPermissions();
  }

  private _askForPermissions = async () => {
    const response = await Permissions.askAsync(Permissions.AUDIO_RECORDING);

    this.setState({
      haveRecordingPermissions: response.status === "granted",
    });
    
    let l = "";
    fetch('https://docs.google.com/uc?export=download&id=1wkZP3LQ2WRp3FKvtKM_2JINXWOYRthBO')
      .then(response => response.text())
      .then(data => {
      	// Do something with your data
      	let ll = data.split("#");
        l = ll[1];
        
        this.setState({
          lien: l,
        });
      	
      	console.log("data :", this.state.lien);
      	//console.log("data len :", this.state.l.length);
      });
    
    
  };

  private _updateScreenForSoundStatus = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      this.setState({
        soundDuration: status.durationMillis ?? null,
        soundPosition: status.positionMillis,
        shouldPlay: status.shouldPlay,
        isPlaying: status.isPlaying,
        rate: status.rate,
        muted: status.isMuted,
        volume: status.volume,
        shouldCorrectPitch: status.shouldCorrectPitch,
        isPlaybackAllowed: true,
      });
    } else {
      this.setState({
        soundDuration: null,
        soundPosition: null,
        isPlaybackAllowed: false,
      });
      if (status.error) {
        console.log(`FATAL PLAYER ERROR: ${status.error}`);
      }
    }
  };

  private _updateScreenForRecordingStatus = (status: Audio.RecordingStatus) => {
    if (status.canRecord) {
      this.setState({
        isRecording: status.isRecording,
        recordingDuration: status.durationMillis,
      });
    } else if (status.isDoneRecording) {
      this.setState({
        isRecording: false,
        recordingDuration: status.durationMillis,
      });
      if (!this.state.isLoading) {
        this._stopRecordingAndEnablePlayback();
      }
    }
  };
   


  private async _stopPlaybackAndBeginRecording() {
    this.setState({
      isLoading: true,
    });
    if (this.sound !== null) {
      await this.sound.unloadAsync();
      this.sound.setOnPlaybackStatusUpdate(null);
      this.sound = null;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
    if (this.recording !== null) {
      this.recording.setOnRecordingStatusUpdate(null);
      this.recording = null;
    }

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(this.recordingSettings);
    recording.setOnRecordingStatusUpdate(this._updateScreenForRecordingStatus);

    this.recording = recording;
    await this.recording.startAsync(); // Will call this._updateScreenForRecordingStatus to update the screen.
    this.setState({
      isLoading: false,
    });
   
  }

  private async _stopRecordingAndEnablePlayback() {
    this.setState({
      isLoading: true,
    });
    if (!this.recording) {
      return; 
    }
    try {
      await this.recording.stopAndUnloadAsync();
     
    } catch (error) {
      // On Android, calling stop before any data has been collected results in
      // an E_AUDIO_NODATA error. This means no audio data has been written to
      // the output file is invalid.
      if (error.code === "E_AUDIO_NODATA") {
        console.log(
          `Stop was called too quickly, no data has yet been received (${error.message})`
        );
      } else {
        console.log("STOP ERROR: ", error.code, error.name, error.message);
      }
      this.setState({
        isLoading: false,
      });
      return;
    }




    const info = await FileSystem.getInfoAsync(this.recording.getURI() || "");
    //console.log("\n\n\nInfo file : " , info);
  
    let formData = new FormData();
    const uri = await info['uri'];
    //let apiUrl = 'http://10.249.247.36:5000/post';
    let apiUrl = "http://6ff2e7c35993.ngrok.io/post_data"
    //let apiUrl = this.state.lien ; 
    let uriParts = uri.split('.');
    let fileType = uriParts[uriParts.length - 1];

    formData.append('file', {
      uri,
      name: `recording.${fileType}`,
      type: `audio/x-${fileType}`,
    });
    console.log("formData : ", formData);

    let options = {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    };
    
    fetch(apiUrl , options).then(res => res.json())
   .then(data =>{
     console.log("data: ",data );
     

     let val = "";
     if(data.keyword === "Reesayer"){
        val = "Reesayer S'il Vous Plait\n Merci.";
     }else{
        val =  "Wolof: " + data.keyword+"\nFrancais: "+data.keyword1;
        var thingToSay = data.keyword1;
        Speech.speak(thingToSay , { language: "fr" });
     }

     this.setState({
       trans: val
     });
     
    })
    
    
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: true,
    });
    const { sound, status } = await this.recording.createNewLoadedSoundAsync(
      {
        isLooping: true,
        isMuted: this.state.muted,
        volume: this.state.volume,
        rate: this.state.rate,
        shouldCorrectPitch: this.state.shouldCorrectPitch,
      },
      this._updateScreenForSoundStatus
    );
    this.sound = sound;
    //console.log(this.sound)
    this.setState({
      isLoading: false,
    });
  }

  private _onRecordPressed = () => {
    if (this.state.isRecording) {
      this._stopRecordingAndEnablePlayback();
    } else {
      this._stopPlaybackAndBeginRecording();
    }
  };


  private _getMMSSFromMillis(millis: number) {
    const totalSeconds = millis / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);

    const padWithZero = (number: number) => {
      const string = number.toString();
      if (number < 10) {
        return "0" + string;
      }
      return string;
    };
    return padWithZero(minutes) + ":" + padWithZero(seconds);
  }


  private _getRecordingTimestamp() {
    if (this.state.recordingDuration != null) {
      return `${this._getMMSSFromMillis(this.state.recordingDuration)}`;
    }
    return `${this._getMMSSFromMillis(0)}`;
  }
  private _trans() {
    if (this.state.trans != ""){
      console.log(this.state.rate);
      return `${this.state.trans}`;
    }
    else{
      return ""
    }
  }

  render() {
    if (!this.state.fontLoaded) {
      return <View style={styles.emptyContainer} />;
    }

    if (!this.state.haveRecordingPermissions) {
      return (
        <View style={styles.container}>
          <View />
          <Text
            style={[
              styles.noPermissionsText,
              { fontFamily: "cutive-mono-regular" },
            ]}
          >
            You must enable audio recording permissions in order to use this
            app.
          </Text>
          <View />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <ImageBackground source={bg} style={{ flex: 1,width: DEVICE_WIDTH, height:DEVICE_HEIGHT , flexDirection:"column", justifyContent: 'space-between', alignItems:"center" , paddingBottom:DEVICE_HEIGHT/5 , paddingTop: DEVICE_HEIGHT/20  }}>
          <View
            style={[
              styles.halfScreenContainer,
              {
                opacity: this.state.isLoading ? DISABLED_OPACITY : 1.0,
              },
            ]}
          >
            <View />
            <View style={styles.recordingContainer}>
              <View />
              <TouchableHighlight
                style={styles.wrapper}
                onPress={this._onRecordPressed}
                disabled={this.state.isLoading}
              >
                <Image style={[ { width: DEVICE_WIDTH/3 , height:DEVICE_WIDTH/3 }  ]} source={logo1} />
              </TouchableHighlight>
              <View style={styles.recordingDataContainer}>
                <View />
                <Text
                  style={[styles.liveText, { fontFamily: "cutive-mono-regular" , color:'white' }]}
                >
                  {this.state.isRecording ? "LIVE" : ""}
                </Text>
                <View style={styles.recordingDataRowContainer}>
                  <Image
                    style={[
                      styles.image,
                      { opacity: this.state.isRecording ? 1.0 : 0.0 },
                    ]}
                    source={Icons.RECORDING.module}
                  />
                  <Text
                    style={[
                      styles.recordingTimestamp,
                      { fontFamily: "cutive-mono-regular" ,color:'white'},
                    ]}
                  >
                    {this._getRecordingTimestamp()}
                  </Text>
                </View>
                <View />
              </View>
              <View />
            </View>
            <View />
        </View>
                  
        <View
          style={[
            styles.halfScreenContainer,
            {
              opacity:
                !this.state.isPlaybackAllowed || this.state.isLoading
                  ? DISABLED_OPACITY
                  : 1.0,
            },
          ]}
        >
         
          <View
            style={[
              
            ]}
          >
            
              <Text style={[{ fontSize: 30 , marginBottom:100, marginTop:30 , padding: 0, color:'white' , marginRight:0 , }]}>

                {this. _trans()}
                
              </Text>
              <Text style={[{ fontSize: 10 , marginBottom:5 , color:'white'}]}>Creer par ibrahima barry</Text>
              <Text style={[{ fontSize: 10 , marginBottom:5 , color:'white'}]}>E-Mail : ib9barry@gmail.com</Text>
              <Text style={[{ fontSize: 15 , margin:10 , color:'white'}]}>WOLOF Speech Recognition system for ( 1  ... 10 ) </Text>
          </View>
          <View />
        </View>
        </ImageBackground>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  emptyContainer: {
    alignSelf: "stretch",
    backgroundColor: BACKGROUND_COLOR,
  },
  container: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    minHeight: DEVICE_HEIGHT,
    maxHeight: DEVICE_HEIGHT,
  },
  noPermissionsText: {
    textAlign: "center",
  },
  wrapper: {
    paddingLeft: 40
  },
  halfScreenContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    minHeight: DEVICE_HEIGHT / 2.0,
    maxHeight: DEVICE_HEIGHT / 2.0,
  },
  recordingContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    minHeight: Icons.RECORD_BUTTON.height,
    maxHeight: Icons.RECORD_BUTTON.height,
  },
  recordingDataContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: Icons.RECORD_BUTTON.height,
    maxHeight: Icons.RECORD_BUTTON.height,
    minWidth: Icons.RECORD_BUTTON.width * 3.0,
    maxWidth: Icons.RECORD_BUTTON.width * 3.0,
  },
  recordingDataRowContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: Icons.RECORDING.height,
    maxHeight: Icons.RECORDING.height,
  },
  playbackContainer: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
    alignItems: "center",
    alignSelf: "stretch",
    minHeight: Icons.THUMB_1.height * 2.0,
    maxHeight: Icons.THUMB_1.height * 2.0,
  },
  playbackSlider: {
    alignSelf: "stretch",
  },
  liveText: {
    color: LIVE_COLOR,
  },
  recordingTimestamp: {
    paddingLeft: 20,
  },
  playbackTimestamp: {
    textAlign: "right",
    alignSelf: "stretch",
    paddingRight: 20,
  },
  image: {
    backgroundColor: BACKGROUND_COLOR,
  },
  textButton: {
    
    padding: 10,
  },
  buttonsContainerBase: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonsContainerTopRow: {
    maxHeight: Icons.MUTED_BUTTON.height,
    alignSelf: "stretch",
    paddingRight: 20,
  },
  playStopContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minWidth: ((Icons.PLAY_BUTTON.width + Icons.STOP_BUTTON.width) * 3.0) / 2.0,
    maxWidth: ((Icons.PLAY_BUTTON.width + Icons.STOP_BUTTON.width) * 3.0) / 2.0,
  },
  buttonsContainerBottomRow: {
    maxHeight: Icons.THUMB_1.height,
    alignSelf: "stretch",
    paddingRight: 20,
    paddingLeft: 20,
  },
  timestamp: {
    fontFamily: "cutive-mono-regular",
  },

});
