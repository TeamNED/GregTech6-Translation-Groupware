#ifndef REPLACERCONFIG_H
#define REPLACERCONFIG_H
#pragma once

#include <exception>
#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include <boost/program_options.hpp>
// clang-format off
#include <ryml/ryml_std.hpp>
#include <ryml/ryml.hpp>
// clang-format on

using std::string;
using std::vector;
namespace po = boost::program_options;

class ReplacerConfig {
private:
  string _main_source_path, _extra_source_path, _main_target_path,
      _extra_target_path, _config_path, _lang, _version;
  string _get_file_contents(const string &filename);

public:
  ReplacerConfig();
  ReplacerConfig(int argc, char const *argv[]);
  ~ReplacerConfig();
};
#endif