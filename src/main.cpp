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
  Replacer worker(config.generators());
  auto result = worker.generate_map();

  // LangFile load & replace
  /*LangFile main_source, main_target, extra_source, extra_target;
  std::ifstream ms_lf(options.main_source_path().string(), std::ios::in);
  ms_lf >> main_source;*/
  return 0;
}