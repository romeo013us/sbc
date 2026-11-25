"""Standalone bilingual synthetic Riva lab. Never transcribes customer calls."""
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import unicodedata
import wave

PIN="2.28.0"
PHRASES={
    "en-US":"Please confirm the website appointment before sending the proposal",
    "es-US":"Por favor confirme la cita antes de enviar la propuesta"
}
VOICES={"en-US":"en-us","es-US":"es"}
def target(value):
    if not isinstance(value,str) or not re.fullmatch(r"127\.0\.0\.1:[1-9][0-9]{0,4}",value) or int(value.split(":")[1])>65535:
        raise ValueError("LOCAL_RIVA_ENDPOINT_REQUIRED")
    return value

def generate(language):
    with tempfile.TemporaryDirectory(prefix="sbc-riva-") as directory:
        wav=Path(directory)/"synthetic.wav"
        subprocess.run(["/usr/bin/espeak-ng","-v",VOICES[language],"-s","145","-w",str(wav),PHRASES[language]],
                       check=True,timeout=10,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                       env={"PATH":"/usr/bin:/bin","LANG":"C.UTF-8"})
        if not wav.is_file() or wav.stat().st_size>2_000_000:raise RuntimeError("AUDIO_SIZE_INVALID")
        with wave.open(str(wav),"rb") as f:
            rate=f.getframerate();frames=f.getnframes()
            if f.getnchannels()!=1 or f.getsampwidth()!=2 or f.getcomptype()!="NONE" or not 8000<=rate<=48000 or not 0<frames<=rate*20:
                raise RuntimeError("AUDIO_FORMAT_INVALID")
            pcm=f.readframes(frames)
            if len(pcm)!=frames*2:raise RuntimeError("AUDIO_SIZE_INVALID")
        return pcm,rate,frames/rate

def words(text):
    return re.findall(r"[^\W_]+",unicodedata.normalize("NFKC",text).casefold(),flags=re.UNICODE)
def errors(reference,hypothesis):
    a,b=words(reference),words(hypothesis)
    if not a or len(a)>200 or len(b)>200:raise RuntimeError("SPEECH_RESULT_INVALID")
    p=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        n=[i]
        for j,y in enumerate(b,1):n.append(min(p[j]+1,n[-1]+1,p[j-1]+int(x!=y)))
        p=n
    return len(a),p[-1]

def run_lab(env=None):
    env={} if env is None else env
    common={"syntheticOnly":True,"productionCertified":False,"providerIdentityAttested":False}
    if env.get("SBC_RIVA_LAB_ENABLED")!="1":return {**common,"status":"DISABLED"}
    endpoint=target(env.get("SBC_RIVA_ENDPOINT"))
    if importlib.metadata.version("nvidia-riva-client")!=PIN:raise RuntimeError("UNREVIEWED_SDK_VERSION")
    import grpc
    from riva.client.proto import riva_asr_pb2 as pb, riva_asr_pb2_grpc as rpc, riva_audio_pb2 as audio_pb
    results={}
    opts=[("grpc.enable_http_proxy",0),("grpc.enable_retries",0),("grpc.max_receive_message_length",262144),("grpc.max_send_message_length",2000000)]
    with grpc.insecure_channel(endpoint,options=opts) as channel:
        grpc.channel_ready_future(channel).result(timeout=5)
        client=rpc.RivaSpeechRecognitionStub(channel)
        for language,reference in PHRASES.items():
            pcm,rate,duration=generate(language)
            config=pb.RecognitionConfig(encoding=audio_pb.AudioEncoding.LINEAR_PCM,sample_rate_hertz=rate,
                language_code=language,max_alternatives=1,audio_channel_count=1,enable_automatic_punctuation=False)
            start=time.monotonic()
            reply=client.Recognize(pb.RecognizeRequest(audio=pcm,config=config),timeout=20)
            elapsed=time.monotonic()-start
            hypothesis=" ".join(r.alternatives[0].transcript for r in reply.results if r.alternatives)
            if len(hypothesis)>2000:raise RuntimeError("SPEECH_RESULT_INVALID")
            total,mistakes=errors(reference,hypothesis)
            results[language]={"referenceWords":total,"wordErrors":mistakes,"wordErrorRate":mistakes/total,
                "audioSeconds":round(duration,3),"inferenceSeconds":round(elapsed,3),"realTimeFactor":round(elapsed/duration,3)}
    return {**common,"status":"SYNTHETIC_SPEECH_MEASURED","languages":results}

if __name__=="__main__":
    try:print(json.dumps(run_lab(os.environ),indent=2))
    except Exception:
        # Never print RPC response contents, endpoint credentials, or subprocess output.
        print(json.dumps({"status":"RIVA_LAB_FAILED","productionCertified":False}))
        raise SystemExit(1)
