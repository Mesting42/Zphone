cmake_minimum_required(VERSION 3.22.1)
project(sitefoundry_node_launcher LANGUAGES CXX)

# The Node archive is prepared outside the source tree and hash checked by
# prepare-runtime.mjs. Both headers and libraries must come from the same build.
if(NOT DEFINED NODE_MOBILE_ROOT)
  message(FATAL_ERROR "NODE_MOBILE_ROOT must point to the verified nodejs-mobile archive")
endif()
add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION "${NODE_MOBILE_ROOT}/bin/${ANDROID_ABI}/libnode.so")

# Android 10 refuses execve() from writable app-data. Package this PIE executable
# under a .so name so PackageManager extracts it to the executable nativeLibraryDir.
# It remains a regular CLI process: child_process.fork then starts this same file.
add_executable(sitefoundrynode node-main.cpp)
set_target_properties(sitefoundrynode PROPERTIES OUTPUT_NAME "libsitefoundrynode.so" BUILD_WITH_INSTALL_RPATH TRUE INSTALL_RPATH "$ORIGIN")
target_include_directories(sitefoundrynode PRIVATE "${NODE_MOBILE_ROOT}/include/node")
target_compile_features(sitefoundrynode PRIVATE cxx_std_20)
target_link_libraries(sitefoundrynode PRIVATE node log)
target_link_options(sitefoundrynode PRIVATE "-Wl,-z,max-page-size=16384")

# npm script interpreter adapter uses only the system shell and packaged Node.
add_executable(sitefoundryshell shell-main.cpp)
set_target_properties(sitefoundryshell PROPERTIES OUTPUT_NAME "libsitefoundryshell.so")
target_compile_features(sitefoundryshell PRIVATE cxx_std_20)
target_link_options(sitefoundryshell PRIVATE "-Wl,-z,max-page-size=16384")
