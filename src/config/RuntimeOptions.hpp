#ifndef RUNTIMEOPTIONS_H
#define RUNTIMEOPTIONS_H
#pragma once

#include <string>
#include <vector>

#include <boost/filesystem.hpp>
#include <boost/program_options.hpp>

using std::string;
using std::vector;
namespace fs = boost::filesystem;
namespace po = boost::program_options;

class RuntimeOptions {
private:
  fs::path _main_source_path, _extra_source_path, _main_target_path,
      _extra_target_path, _config_path, _workplace_path;
  string _lang;

public:
  RuntimeOptions(int argc, char const *argv[]);
  const fs::path &main_source_path() const;
  const fs::path &extra_source_path() const;
  const fs::path &main_target_path() const;
  const fs::path &extra_target_path() const;
  const fs::path &config_path() const;
  const fs::path &workplace_path() const;
  const string &lang() const;
};
#endif