DeepFace = None

def analyze_facial_emotion(image_path):
    """
    Detects emotion from a face in the given image using DeepFace.
    """

    try:
        global DeepFace
        if DeepFace is None:
            from deepface import DeepFace as _DeepFace

            DeepFace = _DeepFace

        result = DeepFace.analyze(image_path, actions=['emotion'])
        emotion = result[0]['dominant_emotion']
        return emotion
    except Exception as e:
        return f"Error : {str(e)}"

