import unittest
from concurrent.futures import ThreadPoolExecutor
import grpc
from riva.client.proto import riva_asr_pb2 as pb, riva_asr_pb2_grpc as rpc
from sbc_riva_lab import run_lab, PHRASES
class SpeechFixture(rpc.RivaSpeechRecognitionServicer):
    def __init__(self): self.requests=[]
    def Recognize(self,request,context):
        self.requests.append(request)
        return pb.RecognizeResponse(results=[pb.SpeechRecognitionResult(alternatives=[pb.SpeechRecognitionAlternative(transcript=PHRASES[request.config.language_code])])])
class RivaTest(unittest.TestCase):
    def test_disabled_and_remote_rejected(self):
        self.assertEqual(run_lab({})["status"],"DISABLED")
        for target in ["api.nvidia.com:443","localhost:50051","127.0.0.1:99999","http://127.0.0.1:50051"]:
            with self.assertRaisesRegex(ValueError,"LOCAL_RIVA_ENDPOINT_REQUIRED"):
                run_lab({"SBC_RIVA_LAB_ENABLED":"1","SBC_RIVA_ENDPOINT":target})
    def test_real_grpc_protocol_with_generated_bilingual_audio(self):
        service=SpeechFixture()
        with ThreadPoolExecutor(max_workers=2) as pool:
            server=grpc.server(pool)
            rpc.add_RivaSpeechRecognitionServicer_to_server(service,server)
            port=server.add_insecure_port("127.0.0.1:0")
            self.assertGreater(port,0)
            server.start()
            try:
                result=run_lab({"SBC_RIVA_LAB_ENABLED":"1","SBC_RIVA_ENDPOINT":f"127.0.0.1:{port}"})
                self.assertEqual(result["status"],"SYNTHETIC_SPEECH_MEASURED")
                self.assertEqual(result["languages"]["en-US"]["wordErrorRate"],0)
                self.assertEqual(result["languages"]["es-US"]["wordErrorRate"],0)
                self.assertFalse(result["productionCertified"])
                self.assertEqual([r.config.language_code for r in service.requests],["en-US","es-US"])
                for r in service.requests:
                    self.assertGreater(len(r.audio),1000)
                    self.assertEqual(r.config.audio_channel_count,1)
                self.assertNotIn("transcript",str(result))
            finally:server.stop(0).wait(5)
if __name__=="__main__":unittest.main()
