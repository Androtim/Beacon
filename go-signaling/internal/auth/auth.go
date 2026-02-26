package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// Validator defines the interface for token validation
type Validator interface {
	ValidateToken(token string) (string, map[string]interface{}, error)
}

// TokenValidator implements Validator
type TokenValidator struct {
	Secret []byte
}

func NewTokenValidator() *TokenValidator {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Default for dev only
		secret = "beacon-secret-dev-key" 
	}
	return &TokenValidator{
		Secret: []byte(secret),
	}
}

// ValidateToken validates the token and returns user ID and metadata
func (v *TokenValidator) ValidateToken(token string) (string, map[string]interface{}, error) {
	if token == "" {
		return "", nil, errors.New("missing token")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", nil, errors.New("invalid token format")
	}

	headerPart, payloadPart, signaturePart := parts[0], parts[1], parts[2]

	// 1. Verify Signature
	message := headerPart + "." + payloadPart
	
	// JWT uses Base64URL encoding
	sig, err := base64.RawURLEncoding.DecodeString(signaturePart)
	if err != nil {
		// Try standard encoding just in case
		sig, err = base64.URLEncoding.DecodeString(signaturePart)
		if err != nil {
			return "", nil, errors.New("invalid signature encoding")
		}
	}

	mac := hmac.New(sha256.New, v.Secret)
	mac.Write([]byte(message))
	expectedSig := mac.Sum(nil)

	if !hmac.Equal(sig, expectedSig) {
		return "", nil, errors.New("invalid signature")
	}

	// 2. Parse Payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadPart)
	if err != nil {
		payloadBytes, err = base64.URLEncoding.DecodeString(payloadPart) // Fallback
		if err != nil {
			return "", nil, errors.New("invalid payload encoding")
		}
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return "", nil, errors.New("invalid payload json")
	}

	// 3. Check Expiry
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return "", nil, errors.New("token expired")
		}
	}

	// Extract User ID
	// Look for standard claims 'sub' or custom 'userId'
	userID, ok := claims["sub"].(string)
	if !ok {
		userID, ok = claims["userId"].(string)
		if !ok {
			return "", nil, errors.New("missing user id in token")
		}
	}

	// Return claims as metadata
	return userID, claims, nil
}

// GenerateToken creates a token for testing
func (v *TokenValidator) GenerateToken(userID string) (string, error) {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"sub":"%s","exp":%d}`, userID, time.Now().Add(time.Hour).Unix())))
	
	message := header + "." + payload
	mac := hmac.New(sha256.New, v.Secret)
	mac.Write([]byte(message))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	
	return message + "." + signature, nil
}
