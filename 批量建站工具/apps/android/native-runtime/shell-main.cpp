#include <fstream>
#include <iterator>
#include <string>
#include <vector>
#include <cstdlib>
#include <unistd.h>

// npm invokes the packaged script-shell executable. Dependency scripts are plain
// readable source in private data, whose execve is prohibited on Android 10+.
// A generated function prelude resolves Node-based package bins directly through
// the installed native Node executable; /system/bin/sh reads all source files.
int main(int argc, char** argv) {
  std::string script;
  std::vector<char*> arguments;
  arguments.push_back(const_cast<char*>("/system/bin/sh"));
  if (argc >= 3 && std::string(argv[1]) == "-c") {
    const char* initialization = std::getenv("SITEFOUNDRY_SHELL_INIT");
    if (initialization) {
      std::ifstream input(initialization);
      script.assign(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
      script += "\n";
    }
    script += argv[2];
    arguments.push_back(argv[1]);
    arguments.push_back(script.data());
    for (int i = 3; i < argc; i++) arguments.push_back(argv[i]);
  } else {
    for (int i = 1; i < argc; i++) arguments.push_back(argv[i]);
  }
  arguments.push_back(nullptr);
  execv(arguments[0], arguments.data());
  return 127;
}
