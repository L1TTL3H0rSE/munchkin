package telemetry

import (
	"net/http"
	"time"
)

type statusWriter struct {
	http.ResponseWriter
	statusCode int
}

type flushStatusWriter struct {
	*statusWriter
	flusher http.Flusher
}

func (writer *flushStatusWriter) Flush() {
	if writer.statusCode == 0 {
		writer.WriteHeader(http.StatusOK)
	}
	writer.flusher.Flush()
}

func (writer *statusWriter) WriteHeader(statusCode int) {
	if writer.statusCode != 0 {
		return
	}
	writer.statusCode = statusCode
	writer.ResponseWriter.WriteHeader(statusCode)
}

func (writer *statusWriter) Write(value []byte) (int, error) {
	if writer.statusCode == 0 {
		writer.WriteHeader(http.StatusOK)
	}
	return writer.ResponseWriter.Write(value)
}

func (writer *statusWriter) Unwrap() http.ResponseWriter {
	return writer.ResponseWriter
}

func WrapHTTP(recorder Recorder, next http.Handler) http.Handler {
	if recorder == nil {
		recorder = Noop()
	}
	return http.HandlerFunc(func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		ctx, end := SafeStartHTTP(
			recorder,
			request.Context(),
			HTTPStart{
				Method: request.Method,
				Header: request.Header.Clone(),
			},
		)
		status := &statusWriter{ResponseWriter: writer}
		observedRequest := request.WithContext(ctx)
		var observedWriter http.ResponseWriter = status
		if flusher, ok := writer.(http.Flusher); ok {
			observedWriter = &flushStatusWriter{
				statusWriter: status,
				flusher:      flusher,
			}
		}
		next.ServeHTTP(observedWriter, observedRequest)
		end(HTTPEnd{
			RoutePattern: observedRequest.Pattern,
			StatusCode:   status.statusCode,
			CompletedAt:  time.Now().UTC(),
		})
	})
}
