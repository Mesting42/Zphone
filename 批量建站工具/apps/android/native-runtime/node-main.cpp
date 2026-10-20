#include <node.h>
#include <cstdlib>
#include <unistd.h>

// A command-line launcher is deliberately used instead of JNI in the UI process.
// Next's workers require a real executable process.execPath; killing a build must
// also be able to terminate its process group without terminating the WebView.
int main(int argc, char** argv) {
  // Android has no public /tmp. The Kotlin bridge supplies its private cache dir.
  // Inherited TMPDIR, HOME and LD_LIBRARY_PATH also reach npm and Next workers.
  return node::Start(argc, argv);
}
