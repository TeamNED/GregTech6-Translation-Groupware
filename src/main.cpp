#include <fstream>
#include <iostream>
#include <string>

#include <fmt/core.h>

#include "Replacer.hpp"
#include "config/ConfigParser.hpp"
#include "config/RuntimeOptions.hpp"
#include "lang/LangFile.hpp"

using std::string;

void assert_path_exist(const fs::path &path) {
  if (!fs::exists(path)) {
    fmt::print("Fatal Error: Could not load file\"{0}\", exit now.",
               path.string());
    exit(1);
  }
}

int main(int argc, char const *argv[]) {
  // runtime options
  RuntimeOptions options(argc, argv);

  // Config load & gen
  Config config = ConfigParser::parse_config(options);
  Replacer worker(config);

  // LangFile load & replace
  worker.replace();
  return 0;
}